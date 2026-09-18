import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FactoryLayoutCanvas } from "../components/FactoryLayoutCanvas/FactoryLayoutCanvas";
import { RealtimeStreamChart } from "../components/RealtimeStreamChart/RealtimeStreamChart";
import { OeeGauge } from "../components/RealtimeStreamChart/OeeGauge";
import { LiquidFillWidget } from "../components/RealtimeStreamChart/LiquidFillWidget";
import { AnomalyAnalysisChart } from "../components/AnomalyAnalysisChart/AnomalyAnalysisChart";
import { Panel, StatusBadge } from "../components/Panel/Panel";
import {
  createMockFactoryLayout,
  simulateStatusChanges,
} from "../mock/factoryLayout";
import { createMockSensorStream } from "../mock/sensorStream";
import type { MockSensorStream } from "../mock/sensorStream";
import { createMockAnomalyDataset } from "../mock/anomalyData";
import { useVizStore } from "../store/vizStore";
import type { EquipmentStatus, SeriesDescriptor } from "../types/domain";
import {
  koAnomalyChartLabels,
  koEquipmentStatusLabels,
  koHourLabel,
  koStatusLabels,
  koThresholdLabels,
  koToolboxLabels,
} from "../mock/labels";

const meta = {
  title: "03. 통합 대시보드/이벤트 연동 데모",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "`FactoryLayoutCanvas` 에서 설비를 클릭하면 `ON_EQUIPMENT_SELECT` 이벤트가 공통 스토어로 전달되고, 우측 차트들이 해당 설비 데이터셋으로 선언적으로 교체됩니다. 컴포넌트끼리는 서로를 전혀 모릅니다.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const layout = createMockFactoryLayout();
const anomalyDataset = createMockAnomalyDataset({
  count: 4000,
  anomalyCount: 4,
});

const SERIES: SeriesDescriptor[] = [
  { key: "temp", name: "온도", unit: "℃" },
  { key: "vib", name: "진동", unit: "mm/s" },
];

export const 설비_선택_연동_대시보드: Story = {
  render: () => {
    const selected = useVizStore((state) => state.selectedEquipment);
    const selectEquipment = useVizStore((state) => state.selectEquipment);
    const [statuses, setStatuses] = useState<Record<string, EquipmentStatus>>(
      {},
    );
    const [stream, setStream] = useState<MockSensorStream | null>(null);

    const ids = useMemo(() => layout.equipments.map((item) => item.id), []);
    useEffect(() => simulateStatusChanges(ids, setStatuses, 3000), [ids]);

    useEffect(() => {
      const instance = createMockSensorStream({
        hz: 30,
        sensors: [
          { sensorId: "temp", base: 72, amplitude: 8, noise: 0.7 },
          {
            sensorId: "vib",
            base: 52,
            amplitude: 14,
            noise: 1.6,
            spikeChance: 0.005,
          },
        ],
      });
      setStream(instance);
      return () => instance.close?.();
    }, []);

    const title = selected ? `${selected.name} (${selected.id})` : "전체 라인";

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 12,
          padding: 12,
          height: "100vh",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr auto",
            gap: 12,
            minHeight: 0,
          }}
        >
          <Panel
            title="공장 레이아웃"
            subtitle="설비를 클릭하면 우측 차트가 전환됩니다"
            height="100%"
            extra={
              selected ? (
                <StatusBadge
                  status={selected.status}
                  label={koStatusLabels[selected.status]}
                />
              ) : undefined
            }
          >
            <FactoryLayoutCanvas
              layout={layout}
              statusLabels={koEquipmentStatusLabels}
              statusOverrides={statuses}
              selectedId={selected?.id ?? null}
              onSelect={(equipment) => selectEquipment(equipment, "dashboard")}
            />
          </Panel>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
            }}
          >
            <Panel title="OEE" height={200}>
              <OeeGauge
                title="OEE"
                metrics={{
                  availability: 0.93,
                  performance: 0.88,
                  quality: 0.97,
                }}
              />
            </Panel>
            <Panel title="원료 탱크" height={200}>
              <LiquidFillWidget value={0.62} label="TANK-01" />
            </Panel>
            <Panel title="선택 설비" height={200}>
              <div
                style={{ padding: 14, fontSize: 12, display: "grid", gap: 8 }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                {selected ? (
                  Object.entries(selected.metrics ?? {}).map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ opacity: 0.7 }}>{key}</span>
                      <span>{value}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ opacity: 0.6 }}>설비를 선택하세요.</span>
                )}
              </div>
            </Panel>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            gap: 12,
            minHeight: 0,
          }}
        >
          <Panel title={`실시간 센서 — ${title}`} height="100%">
            {stream && (
              <RealtimeStreamChart
                thresholdLabels={koThresholdLabels}
                series={SERIES}
                source={stream}
                thresholds={{ warning: 80, critical: 92 }}
              />
            )}
          </Panel>
          <Panel title={`AI 이상 탐지 — ${title}`} height="100%">
            <AnomalyAnalysisChart
              labels={koAnomalyChartLabels}
              toolboxLabels={koToolboxLabels}
              hourLabel={koHourLabel}
              data={anomalyDataset.data}
              predictionBand={anomalyDataset.predictionBand}
              anomalies={anomalyDataset.anomalies}
              markRanges={anomalyDataset.markRanges}
              unit="℃"
            />
          </Panel>
        </div>
      </div>
    );
  },
};
