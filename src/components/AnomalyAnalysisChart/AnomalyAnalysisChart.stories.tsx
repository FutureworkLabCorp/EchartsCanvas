import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnomalyAnalysisChart } from "./AnomalyAnalysisChart";
import type { AnomalyChartMode } from "./AnomalyAnalysisChart";
import { Panel } from "../Panel/Panel";
import { createMockAnomalyDataset } from "../../mock/anomalyData";
import { formatTime } from "../../core/utils/format";

const meta = {
  title: "02. 예시 컴포넌트/AnomalyAnalysisChart",
  component: AnomalyAnalysisChart,
  parameters: {
    docs: {
      description: {
        component:
          "AI 예측 정상범위(MarkArea/밴드), 이상 지점(MarkPoint), 대용량 이력 탐색(DataZoom), Heatmap 전환을 제공하는 이상 탐지 시계열 컴포넌트입니다.",
      },
    },
  },
} satisfies Meta<typeof AnomalyAnalysisChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const dataset = createMockAnomalyDataset({ count: 5000, anomalyCount: 5 });

export const 기본: Story = {
  args: {
    data: dataset.data,
    predictionBand: dataset.predictionBand,
    anomalies: dataset.anomalies,
    markRanges: dataset.markRanges,
    unit: "℃",
  },
  render: (args) => (
    <Panel
      title="주축 온도 이상 탐지"
      subtitle="5,000 포인트 · LTTB 다운샘플"
      height={420}
    >
      <AnomalyAnalysisChart {...args} />
    </Panel>
  ),
};

/** 12만 포인트 대용량 이력 — DataZoom 으로 정밀 탐색 */
export const 대용량_이력_탐색: Story = {
  args: { data: [], unit: "℃" },
  render: (args) => {
    const large = useMemo(
      () =>
        createMockAnomalyDataset({
          count: 120_000,
          intervalMs: 1000,
          anomalyCount: 12,
        }),
      [],
    );
    return (
      <Panel
        title="12만 포인트 이력"
        subtitle="원본 유지 · 렌더 시 2,000 포인트로 축약"
        height={420}
      >
        <AnomalyAnalysisChart
          {...args}
          data={large.data}
          predictionBand={large.predictionBand}
          anomalies={large.anomalies}
          markRanges={large.markRanges}
          downsampleTo={2000}
          initialZoom={[70, 100]}
        />
      </Panel>
    );
  },
};

/** 타임라인 ↔ 히트맵 전환 */
export const 히트맵_전환: Story = {
  args: { data: dataset.data, unit: "℃" },
  render: (args) => {
    const [mode, setMode] = useState<AnomalyChartMode>("timeline");
    return (
      <Panel
        title="패턴 분석"
        subtitle={mode === "timeline" ? "시계열 보기" : "일 × 시간 밀도 보기"}
        height={420}
        extra={
          <button
            type="button"
            onClick={() =>
              setMode(mode === "timeline" ? "heatmap" : "timeline")
            }
          >
            {mode === "timeline" ? "Heatmap 보기" : "Timeline 보기"}
          </button>
        }
      >
        <AnomalyAnalysisChart
          {...args}
          mode={mode}
          predictionBand={dataset.predictionBand}
          anomalies={dataset.anomalies}
        />
      </Panel>
    );
  },
};

/** 이상 지점 클릭 → 상세 패널 연동 */
export const 이상지점_클릭: Story = {
  args: {
    data: dataset.data,
    predictionBand: dataset.predictionBand,
    anomalies: dataset.anomalies,
    unit: "℃",
  },
  render: (args) => {
    const [selected, setSelected] = useState<string>(
      "MarkPoint(핀)를 클릭해 보세요",
    );
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Panel title="이상 탐지" height={360}>
          <AnomalyAnalysisChart
            {...args}
            onAnomalyClick={(anomaly) =>
              setSelected(
                `${formatTime(anomaly.time)} · ${anomaly.label} · score ${anomaly.score} · 값 ${anomaly.value}`,
              )
            }
          />
        </Panel>
        <Panel title="선택된 이상" height={80}>
          <div style={{ padding: 16, fontSize: 13 }}>{selected}</div>
        </Panel>
      </div>
    );
  },
};
