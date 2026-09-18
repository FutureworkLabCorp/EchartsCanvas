import { useCallback, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { BaseChart } from "../../core/BaseChart/BaseChart";
import type {
  BaseChartHandle,
  ChartEventHandler,
} from "../../core/BaseChart/types";
import type { VizEChartsOption } from "../../core/echarts";
import { vizEventBus } from "../../core/EventBus/EventBus";
import { VizEvent } from "../../core/EventBus/events";
import { useVizTheme } from "../../theme/ThemeProvider";
import { lttb } from "../../core/utils/downsample";
import { formatTime } from "../../core/utils/format";
import type {
  AnomalyPoint,
  HeatmapCell,
  PredictionBandPoint,
  TimeRange,
  TimeValuePoint,
} from "../../types/domain";

export type AnomalyChartMode = "timeline" | "heatmap";

export interface AnomalyAnalysisChartProps {
  data: TimeValuePoint[];
  predictionBand?: PredictionBandPoint[];
  anomalies?: AnomalyPoint[];
  markRanges?: TimeRange[];
  mode?: AnomalyChartMode;
  // Unset aggregates `data` into a day-by-hour grid.
  heatmap?: { cells: HeatmapCell[]; xLabels: string[]; yLabels: string[] };
  seriesName?: string;
  unit?: string;
  // 0 renders every point.
  downsampleTo?: number;
  // Percent, not indices.
  initialZoom?: [number, number];
  onAnomalyClick?: (anomaly: AnomalyPoint) => void;
  onRangeChange?: (range: TimeRange) => void;
  className?: string;
  style?: CSSProperties;
}

// The prediction band is drawn as a transparent lower line with the (upper - lower)
// thickness stacked on top, because ECharts has no band series. LTTB plus DataZoom is
// what makes hundreds of thousands of points navigable, and the heatmap view re-buckets
// the same data by day and hour to show a pattern the line hides.
export function AnomalyAnalysisChart({
  data,
  predictionBand,
  anomalies = [],
  markRanges = [],
  mode = "timeline",
  heatmap,
  seriesName = "실측값",
  unit = "",
  downsampleTo = 2000,
  initialZoom,
  onAnomalyClick,
  onRangeChange,
  className,
  style,
}: AnomalyAnalysisChartProps) {
  const theme = useVizTheme();
  const chartRef = useRef<BaseChartHandle>(null);

  const sampled = useMemo(() => {
    if (!downsampleTo || data.length <= downsampleTo) return data;
    return lttb(
      data,
      downsampleTo,
      (p) => p[0],
      (p) => p[1],
    );
  }, [data, downsampleTo]);

  const derivedHeatmap = useMemo(
    () => heatmap ?? (mode === "heatmap" ? aggregateToHeatmap(data) : null),
    [heatmap, mode, data],
  );

  const timelineOption = useMemo<VizEChartsOption>(() => {
    const { palette, font } = theme;

    const lowerSeries: TimeValuePoint[] = [];
    const bandSeries: TimeValuePoint[] = [];
    const predictedSeries: TimeValuePoint[] = [];
    for (const point of predictionBand ?? []) {
      lowerSeries.push([point.time, point.lower]);
      bandSeries.push([point.time, point.upper - point.lower]);
      if (point.predicted !== undefined)
        predictedSeries.push([point.time, point.predicted]);
    }

    return {
      animation: false,
      grid: { left: 8, right: 16, top: 28, bottom: 64, containLabel: true },
      legend: {
        top: 0,
        right: 8,
        data: [seriesName, "예측 정상범위", "AI 예측값"],
        textStyle: { fontSize: font.sizeXs },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        valueFormatter: (value) =>
          typeof value === "number"
            ? `${value.toFixed(2)}${unit}`
            : String(value ?? "-"),
      },
      toolbox: {
        right: 8,
        top: 24,
        feature: {
          dataZoom: {
            yAxisIndex: "none",
            title: { zoom: "영역 확대", back: "되돌리기" },
          },
          restore: { title: "초기화" },
          saveAsImage: { title: "이미지 저장", pixelRatio: 2 },
        },
      },
      xAxis: {
        type: "time",
        axisLabel: { hideOverlap: true, fontSize: font.sizeXs },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { formatter: `{value}${unit}` },
      },
      dataZoom: [
        {
          type: "inside",
          throttle: 50,
          ...(initialZoom
            ? { start: initialZoom[0], end: initialZoom[1] }
            : {}),
        },
        {
          type: "slider",
          height: 28,
          bottom: 12,
          ...(initialZoom
            ? { start: initialZoom[0], end: initialZoom[1] }
            : {}),
        },
      ],
      series: [
        // Invisible; it exists to be the stack baseline.
        {
          id: "band-lower",
          name: "예측 정상범위",
          type: "line",
          stack: "prediction-band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          silent: true,
          data: lowerSeries,
        },
        // The visible band: its height is upper - lower.
        {
          id: "band-width",
          type: "line",
          stack: "prediction-band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { color: palette.predictionBand },
          silent: true,
          data: bandSeries,
        },
        {
          id: "predicted",
          name: "AI 예측값",
          type: "line",
          symbol: "none",
          smooth: true,
          lineStyle: { width: 1, type: "dashed", color: palette.series[4] },
          data: predictedSeries,
        },
        {
          id: "actual",
          name: seriesName,
          type: "line",
          symbol: "none",
          sampling: "lttb",
          lineStyle: { width: 1.5, color: palette.accent },
          data: sampled,
          markArea: markRanges.length
            ? {
                silent: true,
                itemStyle: { opacity: 1 },
                data: markRanges.map((range) => [
                  {
                    xAxis: range.start,
                    name: range.label,
                    itemStyle: { color: rangeColor(range, theme.palette) },
                    label: {
                      show: Boolean(range.label),
                      position: "insideTop",
                      color: palette.textSecondary,
                      fontSize: font.sizeXs,
                    },
                  },
                  { xAxis: range.end },
                ]),
              }
            : undefined,
          markPoint: anomalies.length
            ? {
                symbol: "pin",
                symbolSize: 34,
                label: {
                  fontSize: font.sizeXs,
                  color: palette.background,
                  formatter: "!",
                },
                data: anomalies.map((anomaly) => ({
                  name: anomaly.label ?? "이상 감지",
                  coord: [anomaly.time, anomaly.value],
                  value: anomaly.score.toFixed(2),
                  itemStyle: {
                    color:
                      anomaly.severity === "warning"
                        ? palette.status.warning
                        : palette.status.critical,
                  },
                })),
              }
            : undefined,
        },
      ],
    };
  }, [
    theme,
    predictionBand,
    sampled,
    anomalies,
    markRanges,
    seriesName,
    unit,
    initialZoom,
  ]);

  const heatmapOption = useMemo<VizEChartsOption>(() => {
    const { palette, font } = theme;
    const cells = derivedHeatmap?.cells ?? [];
    const values = cells.map((cell) => cell.value);
    const max = values.length ? Math.max(...values) : 1;

    return {
      animation: false,
      grid: { left: 8, right: 16, top: 16, bottom: 64, containLabel: true },
      tooltip: { position: "top" },
      xAxis: {
        type: "category",
        data: derivedHeatmap?.xLabels ?? [],
        splitArea: { show: true },
        axisLabel: { fontSize: font.sizeXs, interval: 1 },
      },
      yAxis: {
        type: "category",
        data: derivedHeatmap?.yLabels ?? [],
        splitArea: { show: true },
        axisLabel: { fontSize: font.sizeXs },
      },
      visualMap: {
        min: 0,
        max,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 12,
        itemHeight: 100,
        textStyle: { fontSize: font.sizeXs },
        inRange: {
          color: [
            palette.surface,
            palette.accent,
            palette.status.warning,
            palette.status.critical,
          ],
        },
      },
      series: [
        {
          type: "heatmap",
          data: cells.map((cell) => [cell.x, cell.y, cell.value]),
          progressive: 2000,
          emphasis: {
            itemStyle: { borderColor: palette.textPrimary, borderWidth: 1 },
          },
          itemStyle: { borderColor: palette.background, borderWidth: 0.5 },
        },
      ],
    };
  }, [theme, derivedHeatmap]);

  const handleClick = useCallback<ChartEventHandler>(
    (params) => {
      const info = params as {
        componentType?: string;
        data?: { coord?: [number, number] };
      };
      if (info.componentType !== "markPoint") return;
      const coord = info.data?.coord;
      if (!coord) return;
      const anomaly = anomalies.find((item) => item.time === coord[0]);
      if (!anomaly) return;
      onAnomalyClick?.(anomaly);
      vizEventBus.emit(VizEvent.ANOMALY_SELECT, {
        anomaly,
        source: "AnomalyAnalysisChart",
      });
    },
    [anomalies, onAnomalyClick],
  );

  const handleDataZoom = useCallback<ChartEventHandler>(
    (_params, chart) => {
      if (
        !onRangeChange &&
        vizEventBus.listenerCount(VizEvent.TIME_RANGE_CHANGE) === 0
      )
        return;

      const range = readZoomRange(chart.getOption() as ZoomOption, data);
      if (!range) return;

      onRangeChange?.(range);
      vizEventBus.emit(VizEvent.TIME_RANGE_CHANGE, {
        range,
        source: "AnomalyAnalysisChart",
      });
    },
    [onRangeChange, data],
  );

  const events = useMemo(
    () => ({ click: handleClick, datazoom: handleDataZoom }),
    [handleClick, handleDataZoom],
  );

  return (
    <BaseChart
      ref={chartRef}
      option={mode === "heatmap" ? heatmapOption : timelineOption}
      notMerge
      events={events}
      className={className}
      style={style}
      ariaLabel="AI 이상 탐지 시계열 차트"
    />
  );
}

function rangeColor(
  range: TimeRange,
  palette: ReturnType<typeof useVizTheme>["palette"],
): string {
  if (range.severity === "critical") return palette.thresholdCritical;
  if (range.severity === "warning") return palette.thresholdWarning;
  return palette.predictionBand;
}

interface ZoomOption {
  dataZoom?: Array<{
    start?: number;
    end?: number;
    startValue?: number;
    endValue?: number;
  }>;
}

// ECharts fills startValue on a drag-zoom and start on a wheel-zoom, never both, so the
// visible range has to be read from whichever one is present.
function readZoomRange(
  option: ZoomOption,
  data: readonly TimeValuePoint[],
): TimeRange | null {
  const zoom = option.dataZoom?.[0];
  if (!zoom) return null;

  if (
    typeof zoom.startValue === "number" &&
    typeof zoom.endValue === "number"
  ) {
    return { start: zoom.startValue, end: zoom.endValue };
  }

  const first = data[0];
  const last = data[data.length - 1];
  if (!first || !last) return null;

  const span = last[0] - first[0];
  const start = first[0] + (span * (zoom.start ?? 0)) / 100;
  const end = first[0] + (span * (zoom.end ?? 100)) / 100;
  return { start, end };
}

export function aggregateToHeatmap(data: readonly TimeValuePoint[]): {
  cells: HeatmapCell[];
  xLabels: string[];
  yLabels: string[];
} {
  const buckets = new Map<string, { sum: number; count: number }>();
  const days: string[] = [];

  for (const [time, value] of data) {
    const date = new Date(time);
    const dayKey = `${date.getMonth() + 1}/${date.getDate()}`;
    if (!days.includes(dayKey)) days.push(dayKey);
    const key = `${dayKey}|${date.getHours()}`;
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const xLabels = Array.from({ length: 24 }, (_, hour) => `${hour}시`);
  const cells: HeatmapCell[] = [];
  for (const [key, bucket] of buckets) {
    const [dayKey, hourText] = key.split("|");
    if (!dayKey || hourText === undefined) continue;
    cells.push({
      x: Number(hourText),
      y: days.indexOf(dayKey),
      value: Number((bucket.sum / bucket.count).toFixed(2)),
    });
  }

  return { cells, xLabels, yLabels: days };
}

export const formatAnomalyTime = (time: number): string =>
  formatTime(time, true);
