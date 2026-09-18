import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BaseChart } from "../core/BaseChart/BaseChart";
import { Canvas2DBase } from "../core/Canvas2DBase/Canvas2DBase";
import type { Canvas2DDrawArgs, Point } from "../core/Canvas2DBase/types";
import { hitCircle, pickTopMost } from "../core/Canvas2DBase/hit";
import { DataStreamBuffer } from "../core/DataStreamBuffer/DataStreamBuffer";
import type { BufferStats } from "../core/DataStreamBuffer/types";
import { createMockSensorStream } from "../mock/sensorStream";
import { Panel } from "../components/Panel/Panel";
import type { VizEChartsOption } from "../core/echarts";
import { ThemeProvider } from "../theme/ThemeProvider";
import { createTheme, industrialDark, industrialLight } from "../theme/presets";

const meta = {
  title: "01. 공통 모듈/Core Engine",
  parameters: {
    docs: {
      description: {
        component:
          "`BaseChart`, `Canvas2DBase`, `DataStreamBuffer`, Theme 시스템의 동작을 개별적으로 확인합니다.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// BaseChart: the chart follows its container through ResizeObserver.
export const BaseChart_반응형: Story = {
  render: () => {
    const [width, setWidth] = useState(70);
    const option = useMemo<VizEChartsOption>(
      () => ({
        tooltip: { trigger: "axis" },
        xAxis: {
          type: "category",
          data: ["월", "화", "수", "목", "금", "토", "일"],
        },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            name: "생산량",
            smooth: true,
            areaStyle: {},
            data: [820, 932, 901, 934, 1290, 1330, 1320],
          },
          {
            type: "line",
            name: "불량",
            smooth: true,
            data: [20, 32, 21, 34, 90, 33, 32],
          },
        ],
      }),
      [],
    );

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ fontSize: 12 }}>
          컨테이너 너비: {width}%
          <input
            type="range"
            min={30}
            max={100}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            style={{ width: "100%" }}
          />
        </label>
        <div style={{ width: `${width}%`, transition: "width 120ms" }}>
          <Panel
            title="BaseChart"
            subtitle="컨테이너 리사이즈 → resize() 자동 호출"
            height={300}
          >
            <BaseChart option={option} />
          </Panel>
        </div>
      </div>
    );
  },
};

interface Bubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}

// Canvas2DBase: animation loop and hit detection.
export const Canvas2DBase_히트감지: Story = {
  render: () => {
    const bubblesRef = useRef<Bubble[]>(
      Array.from({ length: 24 }, (_, id) => ({
        id,
        x: 60 + (id % 8) * 90,
        y: 60 + Math.floor(id / 8) * 90,
        radius: 16 + (id % 5) * 4,
        vx: (id % 3) - 1,
        vy: ((id + 1) % 3) - 1,
      })),
    );
    const [picked, setPicked] = useState<number | null>(null);

    const draw = useCallback(
      ({ ctx, width, height, theme, frame }: Canvas2DDrawArgs) => {
        for (const bubble of bubblesRef.current) {
          bubble.x += bubble.vx * (frame.delta / 16);
          bubble.y += bubble.vy * (frame.delta / 16);
          if (bubble.x < bubble.radius || bubble.x > width - bubble.radius)
            bubble.vx *= -1;
          if (bubble.y < bubble.radius || bubble.y > height - bubble.radius)
            bubble.vy *= -1;

          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
          ctx.fillStyle =
            theme.palette.series[bubble.id % theme.palette.series.length] ??
            theme.palette.accent;
          ctx.globalAlpha = 0.75;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      },
      [],
    );

    const hitTest = useCallback(
      (point: Point) =>
        pickTopMost(bubblesRef.current, (bubble) => hitCircle(point, bubble)),
      [],
    );

    return (
      <Panel
        title="Canvas2DBase"
        subtitle={`클릭한 객체: ${picked ?? "없음"}`}
        height={400}
      >
        <Canvas2DBase<Bubble>
          onDraw={draw}
          hitTest={hitTest}
          onItemClick={(bubble) => setPicked(bubble.id)}
        />
      </Panel>
    );
  },
};

// DataStreamBuffer: arrival rate against flush rate.
export const DataStreamBuffer_처리량: Story = {
  render: () => {
    const [stats, setStats] = useState<BufferStats | null>(null);
    const [flushCount, setFlushCount] = useState(0);
    const [interval, setIntervalMs] = useState(200);

    useEffect(() => {
      const buffer = new DataStreamBuffer<{ time: number; value: number }>({
        interval,
        mode: "throttle",
        capacity: 20_000,
      });
      const stream = createMockSensorStream({
        hz: 500,
        burst: 10,
        sensors: [{ sensorId: "s1", base: 50 }],
      });

      const off = buffer.subscribe((_items, nextStats) => {
        setStats(nextStats);
        setFlushCount((count) => count + 1);
      });
      const disconnect = buffer.connect({
        subscribe: (handler) =>
          stream.subscribe((sample) =>
            handler({ time: sample.time, value: sample.value }),
          ),
      });

      return () => {
        off();
        disconnect();
        stream.close?.();
        buffer.dispose();
      };
    }, [interval]);

    return (
      <Panel
        title="DataStreamBuffer"
        subtitle="500Hz 유입 → throttle flush"
        height={260}
      >
        <div style={{ padding: 16, display: "grid", gap: 10, fontSize: 13 }}>
          <label>
            flush 주기: {interval}ms
            <input
              type="range"
              min={50}
              max={1000}
              step={50}
              value={interval}
              onChange={(event) => setIntervalMs(Number(event.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <div>유입 처리량: {stats?.inboundRate ?? 0} samples/sec</div>
          <div>총 수신: {stats?.received ?? 0}</div>
          <div>총 방출: {stats?.flushed ?? 0}</div>
          <div>flush 호출 수: {flushCount} (= setOption 호출 횟수)</div>
          <div>현재 버퍼 크기: {stats?.bufferSize ?? 0}</div>
        </div>
      </Panel>
    );
  },
};

// Theme: injecting a custom theme.
export const 커스텀_테마_주입: Story = {
  render: () => {
    const plantTheme = useMemo(
      () =>
        createTheme(industrialDark, {
          name: "plant-a",
          palette: {
            background: "#0d0f14",
            surface: "#161a22",
            accent: "#ff922b",
            series: ["#ff922b", "#4dabf7", "#38d9a9", "#e599f7"],
            status: { critical: "#f03e3e", normal: "#51cf66" },
          },
        }),
      [],
    );

    const option = useMemo<VizEChartsOption>(
      () => ({
        tooltip: {},
        xAxis: { type: "category", data: ["A", "B", "C", "D", "E"] },
        yAxis: { type: "value" },
        series: [
          { type: "line", data: [120, 200, 150, 80, 170], areaStyle: {} },
        ],
      }),
      [],
    );

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        {[industrialDark, industrialLight, plantTheme].map((theme) => (
          <ThemeProvider key={theme.name} theme={theme}>
            <Panel title={theme.name} height={260}>
              <BaseChart option={option} />
            </Panel>
          </ThemeProvider>
        ))}
      </div>
    );
  },
};
