import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RealtimeStreamChart } from "./RealtimeStreamChart";
import { OeeGauge } from "./OeeGauge";
import { LiquidFillWidget } from "./LiquidFillWidget";
import { Panel } from "../Panel/Panel";
import { createMockSensorStream } from "../../mock/sensorStream";
import type { MockSensorStream } from "../../mock/sensorStream";
import { useVizEvent } from "../../store/vizStore";
import { VizEvent } from "../../core/EventBus/events";
import type { SeriesDescriptor } from "../../types/domain";

const meta = {
  title: "02. 예시 컴포넌트/RealtimeStreamChart",
  component: RealtimeStreamChart,
  parameters: {
    docs: {
      description: {
        component:
          "고주파 센서 스트림을 `DataStreamBuffer` 로 완충한 뒤 일정 주기로만 차트에 주입하는 실시간 모니터링 컴포넌트입니다. 데이터는 React state 가 아닌 링버퍼(ref)에 적재되어 초당 수백 건이 들어와도 리렌더가 발생하지 않습니다.",
      },
    },
  },
} satisfies Meta<typeof RealtimeStreamChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const SERIES: SeriesDescriptor[] = [
  { key: "temp-01", name: "주축 온도", unit: "℃" },
  { key: "vib-01", name: "진동", unit: "mm/s" },
];

function useMockStream(hz: number, burst = 1): MockSensorStream | null {
  const [stream, setStream] = useState<MockSensorStream | null>(null);

  useEffect(() => {
    const instance = createMockSensorStream({
      hz,
      burst,
      sensors: [
        {
          sensorId: "temp-01",
          equipmentId: "CNC-01",
          base: 72,
          amplitude: 6,
          noise: 0.6,
          spikeChance: 0.004,
        },
        {
          sensorId: "vib-01",
          equipmentId: "CNC-01",
          base: 55,
          amplitude: 12,
          noise: 1.4,
          spikeChance: 0.006,
        },
      ],
    });
    setStream(instance);
    return () => instance.close?.();
  }, [hz, burst]);

  return stream;
}

// 20Hz stream with thresholds drawn.
export const 기본: Story = {
  args: { series: SERIES },
  render: (args) => {
    const stream = useMockStream(20);
    return (
      <Panel
        title="CNC-01 실시간 모니터링"
        subtitle="20Hz · flush 200ms"
        height={360}
      >
        {stream && (
          <RealtimeStreamChart
            {...args}
            source={stream}
            thresholds={{ warning: 80, critical: 90 }}
            yAxis={{ min: 30, max: 110, name: "값" }}
          />
        )}
      </Panel>
    );
  },
};

// Checks the frame rate holds at 1,000 arrivals a second.
export const 고주파_1000Hz: Story = {
  args: { series: SERIES },
  render: (args) => {
    const stream = useMockStream(1000, 25);
    return (
      <Panel
        title="고주파 스트레스 테스트"
        subtitle="센서당 1,000 samples/sec · burst 25"
        height={360}
      >
        {stream && (
          <RealtimeStreamChart
            {...args}
            source={stream}
            windowSize={1200}
            flushInterval={250}
            thresholds={{ warning: 80, critical: 90 }}
          />
        )}
      </Panel>
    );
  },
};

// Receiving ON_THRESHOLD_BREACH on a threshold crossing.
export const 임계치_경고_이벤트: Story = {
  args: { series: [SERIES[0] as SeriesDescriptor] },
  render: (args) => {
    const stream = useMockStream(20);
    const [logs, setLogs] = useState<string[]>([]);

    useVizEvent(VizEvent.THRESHOLD_BREACH, (payload) => {
      setLogs((prev) =>
        [
          `[${payload.level}] ${payload.sensorId} = ${payload.value} (기준 ${payload.threshold})`,
          ...prev,
        ].slice(0, 6),
      );
    });

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Panel
          title="드리프트 시나리오"
          subtitle="값이 서서히 상승해 임계치를 넘습니다"
          height={300}
          extra={
            <button
              type="button"
              onClick={() => stream?.injectAnomaly("temp-01", 40)}
            >
              이상값 주입
            </button>
          }
        >
          {stream && (
            <RealtimeStreamChart
              {...args}
              source={stream}
              thresholds={{ warning: 80, critical: 90 }}
            />
          )}
        </Panel>
        <Panel title="수신된 이벤트" height={140}>
          <ul
            style={{
              margin: 0,
              padding: "8px 16px",
              fontSize: 12,
              lineHeight: 1.8,
            }}
          >
            {logs.length === 0 ? (
              <li>아직 없음</li>
            ) : (
              logs.map((log, i) => <li key={i}>{log}</li>)
            )}
          </ul>
        </Panel>
      </div>
    );
  },
};

// The OEE gauge and the LiquidFill widget alongside the chart.
export const OEE_위젯_연동: Story = {
  args: { series: SERIES },
  render: (args) => {
    const stream = useMockStream(20);
    const [tick, setTick] = useState(0);

    useEffect(() => {
      const timer = setInterval(() => setTick((t) => t + 1), 3000);
      return () => clearInterval(timer);
    }, []);

    const metrics = useMemo(
      () => ({
        availability: 0.9 + Math.sin(tick / 3) * 0.06,
        performance: 0.86 + Math.cos(tick / 4) * 0.08,
        quality: 0.97,
      }),
      [tick],
    );

    return (
      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}
      >
        <Panel title="실시간 센서" height={320}>
          {stream && (
            <RealtimeStreamChart
              {...args}
              source={stream}
              thresholds={{ warning: 80, critical: 90 }}
            />
          )}
        </Panel>
        <Panel title="OEE" height={320}>
          <OeeGauge metrics={metrics} />
        </Panel>
        <Panel title="탱크 수위" height={320}>
          <LiquidFillWidget
            value={0.4 + Math.sin(tick / 5) * 0.3}
            label="원료 탱크"
          />
        </Panel>
      </div>
    );
  },
};
