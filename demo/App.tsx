import { useEffect, useMemo, useState } from "react";
import {
  AnomalyAnalysisChart,
  FactoryLayoutCanvas,
  LiquidFillWidget,
  OeeGauge,
  Panel,
  RealtimeStreamChart,
  StatusBadge,
  ThemeProvider,
  VizEvent,
  createMockAnomalyDataset,
  createMockFactoryLayout,
  createMockSensorStream,
  industrialDark,
  industrialLight,
  simulateStatusChanges,
  useVizEvent,
  useVizStore,
} from "../src";
import type {
  EquipmentStatus,
  MockSensorStream,
  SeriesDescriptor,
} from "../src";
import {
  koAnomalyChartLabels,
  koEquipmentStatusLabels,
  koHourLabel,
  koStatusLabels,
  koThresholdLabels,
  koToolboxLabels,
} from "../src/mock/labels";

const layout = createMockFactoryLayout();
const anomalyDataset = createMockAnomalyDataset({
  count: 6000,
  anomalyCount: 5,
});

const SERIES: SeriesDescriptor[] = [
  { key: "temp", name: "온도", unit: "℃" },
  { key: "vib", name: "진동", unit: "mm/s" },
  { key: "load", name: "부하", unit: "%" },
];

export function App() {
  const [dark, setDark] = useState(true);

  return (
    <ThemeProvider
      theme={dark ? industrialDark : industrialLight}
      style={{ height: "100%" }}
    >
      <Dashboard dark={dark} onToggleTheme={() => setDark((value) => !value)} />
    </ThemeProvider>
  );
}

function Dashboard({
  dark,
  onToggleTheme,
}: {
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const selected = useVizStore((state) => state.selectedEquipment);
  const selectEquipment = useVizStore((state) => state.selectEquipment);
  const [statuses, setStatuses] = useState<Record<string, EquipmentStatus>>({});
  const [stream, setStream] = useState<MockSensorStream | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  const equipmentIds = useMemo(
    () => layout.equipments.map((item) => item.id),
    [],
  );

  useEffect(
    () => simulateStatusChanges(equipmentIds, setStatuses, 3000),
    [equipmentIds],
  );

  useEffect(() => {
    const instance = createMockSensorStream({
      hz: 60,
      burst: 3,
      sensors: [
        {
          sensorId: "temp",
          base: 74,
          amplitude: 7,
          noise: 0.8,
          spikeChance: 0.003,
        },
        {
          sensorId: "vib",
          base: 48,
          amplitude: 15,
          noise: 1.5,
          spikeChance: 0.005,
        },
        { sensorId: "load", base: 66, amplitude: 18, noise: 2 },
      ],
    });
    setStream(instance);
    return () => instance.close?.();
  }, []);

  // Read off the bus, so this panel never imports the component that emitted it.
  useVizEvent(VizEvent.THRESHOLD_BREACH, (payload) => {
    setAlerts((prev) =>
      [
        `${payload.level === "critical" ? "🔴" : "🟡"} ${payload.sensorId} ${payload.value} (기준 ${payload.threshold})`,
        ...prev,
      ].slice(0, 5),
    );
  });

  const title = selected ? `${selected.name} · ${selected.id}` : "전체 라인";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: 12,
        height: "100%",
        padding: 12,
        boxSizing: "border-box",
        background: "var(--viz-bg)",
        color: "var(--viz-text-primary)",
        fontFamily: "var(--viz-font)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            제조 AX 통합 관제 대시보드
          </div>
          <div style={{ fontSize: 12, color: "var(--viz-text-muted)" }}>
            공통 시각화 컴포넌트 프레임워크 데모 · 설비를 클릭하면 우측 차트가
            전환됩니다
          </div>
        </div>
        <button type="button" onClick={onToggleTheme} style={buttonStyle}>
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr",
          gap: 12,
          minHeight: 0,
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
            title="공장 레이아웃 (Canvas2DBase)"
            subtitle="휠 확대 · 드래그 이동 · 클릭 선택"
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
              onSelect={(equipment) => selectEquipment(equipment, "demo")}
            />
          </Panel>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <Panel title="OEE" height={190}>
              <OeeGauge
                title="OEE"
                metrics={{
                  availability: 0.94,
                  performance: 0.87,
                  quality: 0.98,
                }}
              />
            </Panel>
            <Panel title="원료 탱크" height={190}>
              <LiquidFillWidget value={0.63} label="TANK-01" />
            </Panel>
            <Panel title="임계치 알림" height={190}>
              <ul
                style={{
                  margin: 0,
                  padding: "10px 16px",
                  fontSize: 12,
                  lineHeight: 1.9,
                }}
              >
                {alerts.length === 0 ? (
                  <li style={{ color: "var(--viz-text-muted)" }}>알림 없음</li>
                ) : (
                  alerts.map((alert, index) => <li key={index}>{alert}</li>)
                )}
              </ul>
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
          <Panel
            title={`실시간 스트리밍 — ${title}`}
            subtitle="60Hz × 3센서 · flush 200ms"
            height="100%"
          >
            {stream && (
              <RealtimeStreamChart
                thresholdLabels={koThresholdLabels}
                series={SERIES}
                source={stream}
                windowSize={800}
                thresholds={{ warning: 82, critical: 92 }}
              />
            )}
          </Panel>
          <Panel
            title={`AI 이상 탐지 — ${title}`}
            subtitle="6,000 포인트 · DataZoom 탐색"
            height="100%"
          >
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
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "var(--viz-surface-alt)",
  color: "var(--viz-text-primary)",
  border: "1px solid var(--viz-border)",
  borderRadius: "var(--viz-radius)",
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};
