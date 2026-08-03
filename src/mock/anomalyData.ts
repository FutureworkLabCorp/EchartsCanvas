import type {
  AnomalyPoint,
  PredictionBandPoint,
  TimeRange,
  TimeValuePoint,
} from "../types/domain";
import { createRandom, gaussian } from "./random";

export interface MockAnomalyOptions {
  /** 생성할 포인트 수(기본 5000 — 대용량 DataZoom 탐색 시연용) */
  count?: number;
  /** 샘플 간격(ms) */
  intervalMs?: number;
  /** 종료 시각(기본 now) */
  endTime?: number;
  base?: number;
  seed?: number;
  /** 삽입할 이상 구간 수 */
  anomalyCount?: number;
}

export interface MockAnomalyDataset {
  data: TimeValuePoint[];
  predictionBand: PredictionBandPoint[];
  anomalies: AnomalyPoint[];
  markRanges: TimeRange[];
}

/**
 * AI 이상 탐지 시연용 데이터셋.
 * 정상 구간에서는 예측 밴드 안에 머물다가, 이상 구간에서 밴드를 벗어나도록 생성한다.
 */
export function createMockAnomalyDataset({
  count = 5000,
  intervalMs = 30_000,
  endTime = Date.now(),
  base = 72,
  seed = 20260803,
  anomalyCount = 5,
}: MockAnomalyOptions = {}): MockAnomalyDataset {
  const random = createRandom(seed);
  const startTime = endTime - count * intervalMs;

  // 이상 구간 위치를 미리 정한다(전체의 앞/뒤 5% 는 제외).
  const anomalyWindows = Array.from({ length: anomalyCount }, (_, i) => {
    const center = Math.floor(count * (0.1 + (0.8 * (i + 0.5)) / anomalyCount));
    const width = 6 + Math.floor(random() * 18);
    return {
      start: center - width,
      end: center + width,
      severity: random() > 0.5 ? "critical" : ("warning" as const),
    };
  });

  const data: TimeValuePoint[] = [];
  const predictionBand: PredictionBandPoint[] = [];
  const anomalies: AnomalyPoint[] = [];
  const markRanges: TimeRange[] = [];

  for (const window of anomalyWindows) {
    markRanges.push({
      start: startTime + window.start * intervalMs,
      end: startTime + window.end * intervalMs,
      label: window.severity === "critical" ? "이상 구간" : "주의 구간",
      severity: window.severity === "critical" ? "critical" : "warning",
    });
  }

  for (let i = 0; i < count; i += 1) {
    const time = startTime + i * intervalMs;
    // 일 주기(2π/2880 ≈ 24시간 @30초 간격) + 완만한 추세
    const seasonal = Math.sin((i / 2880) * Math.PI * 2) * 6;
    const trend = (i / count) * 3;
    const predicted = base + seasonal + trend;

    const window = anomalyWindows.find((w) => i >= w.start && i <= w.end);
    const deviation = window
      ? (window.severity === "critical" ? 14 : 8) *
        Math.sin(((i - window.start) / (window.end - window.start)) * Math.PI)
      : 0;

    const value = Number(
      (predicted + gaussian(random, 0, 1.1) + deviation).toFixed(2),
    );
    data.push([time, value]);

    // 밴드는 렌더 비용을 줄이기 위해 10포인트마다 기록
    if (i % 10 === 0) {
      predictionBand.push({
        time,
        lower: Number((predicted - 4.5).toFixed(2)),
        upper: Number((predicted + 4.5).toFixed(2)),
        predicted: Number(predicted.toFixed(2)),
      });
    }

    // 각 이상 구간의 피크 1점만 마킹
    if (window && i === Math.round((window.start + window.end) / 2)) {
      anomalies.push({
        time,
        value,
        score: Number((0.6 + random() * 0.39).toFixed(2)),
        label: window.severity === "critical" ? "임계 이탈" : "패턴 이상",
        severity: window.severity === "critical" ? "critical" : "warning",
      });
    }
  }

  return { data, predictionBand, anomalies, markRanges };
}
