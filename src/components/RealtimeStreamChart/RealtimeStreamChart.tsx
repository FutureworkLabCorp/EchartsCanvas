import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { BaseChart } from "../../core/BaseChart/BaseChart";
import type { BaseChartHandle } from "../../core/BaseChart/types";
import type { VizEChartsOption } from "../../core/echarts";
import { RingBuffer } from "../../core/utils/RingBuffer";
import { useDataStream } from "../../hooks/useDataStream";
import type { StreamSource } from "../../core/DataStreamBuffer/types";
import { vizEventBus } from "../../core/EventBus/EventBus";
import { VizEvent } from "../../core/EventBus/events";
import { useVizTheme } from "../../theme/ThemeProvider";
import type {
  SensorSample,
  SeriesDescriptor,
  ThresholdConfig,
  TimeValuePoint,
} from "../../types/domain";

export interface RealtimeStreamChartProps {
  // Each key matches a SensorSample.sensorId.
  series: SeriesDescriptor[];
  // A function form is invoked once on mount.
  source?:
    StreamSource<SensorSample> | (() => StreamSource<SensorSample>) | null;
  // Per series. The ring buffer drops the oldest past this.
  windowSize?: number;
  flushInterval?: number;
  // Drives both the visualMap colouring and the ON_THRESHOLD_BREACH event.
  thresholds?: ThresholdConfig;
  // Filters intake, so selecting equipment elsewhere narrows this chart.
  equipmentId?: string | null;
  // Keeps buffering while paused, so resuming shows the gap rather than losing it.
  paused?: boolean;
  yAxis?: { min?: number; max?: number; name?: string };
  initialData?: SensorSample[];
  showLegend?: boolean;
  // Annotates the threshold lines. Each formatter takes the threshold value, because
  // word order around a number is not the same in every language. Unset draws the line
  // without a label.
  thresholdLabels?: {
    warning?: (value: number) => string;
    critical?: (value: number) => string;
  };
  // Unset renders no aria-label rather than a fabricated one.
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

// Samples land in a ring buffer held in a ref, never in state, so several hundred
// arrivals a second cause no re-render. A throttled DataStreamBuffer then drives one
// setOption per flush, and `sampling: 'lttb'` keeps the draw cost flat once the point
// count passes the pixel width.
export const RealtimeStreamChart = ({
  series,
  source,
  windowSize = 600,
  flushInterval = 200,
  thresholds,
  equipmentId = null,
  paused = false,
  yAxis,
  initialData,
  showLegend = true,
  thresholdLabels,
  ariaLabel,
  className,
  style,
}: RealtimeStreamChartProps) => {
  const theme = useVizTheme();
  const chartRef = useRef<BaseChartHandle>(null);
  const buffersRef = useRef(new Map<string, RingBuffer<TimeValuePoint>>());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const equipmentRef = useRef(equipmentId);
  equipmentRef.current = equipmentId;
  // Previous level per sensor, so an event fires on a transition rather than per sample.
  const breachLevelRef = useRef(
    new Map<string, "normal" | "warning" | "critical">(),
  );

  useEffect(() => {
    const next = new Map<string, RingBuffer<TimeValuePoint>>();
    for (const descriptor of series) {
      next.set(
        descriptor.key,
        buffersRef.current.get(descriptor.key) ?? new RingBuffer(windowSize),
      );
    }
    buffersRef.current = next;
  }, [series, windowSize]);

  const pushSample = useCallback(
    (sample: SensorSample) => {
      if (equipmentRef.current && sample.equipmentId !== equipmentRef.current)
        return;
      const ring = buffersRef.current.get(sample.sensorId);
      if (!ring) return;
      ring.push([sample.time, sample.value]);
      detectBreach(sample, thresholds, breachLevelRef.current);
    },
    [thresholds],
  );

  const applyToChart = useCallback(() => {
    const chart = chartRef.current?.getInstance();
    if (!chart || chart.isDisposed() || pausedRef.current) return;

    // Matching by id and replacing only `data`: a notMerge update would rebuild the
    // axes and tooltip on every flush.
    chart.setOption(
      {
        series: series.map((descriptor) => ({
          id: descriptor.key,
          data: buffersRef.current.get(descriptor.key)?.toArray() ?? [],
        })),
      },
      { lazyUpdate: true },
    );
  }, [series]);

  const { push } = useDataStream<SensorSample>({
    source: source ?? null,
    interval: flushInterval,
    mode: "throttle",
    capacity: windowSize * Math.max(1, series.length) * 2,
    onFlush: (items) => {
      for (const sample of items) pushSample(sample);
      applyToChart();
    },
  });

  useEffect(() => {
    if (!initialData?.length) return;
    for (const sample of initialData) pushSample(sample);
    applyToChart();
  }, [initialData, pushSample, applyToChart]);

  useEffect(() => {
    if (!paused) applyToChart();
  }, [paused, applyToChart]);

  const option = useMemo<VizEChartsOption>(() => {
    const { palette, font } = theme;
    const critical = thresholds?.critical;
    const warning = thresholds?.warning;

    return {
      // A transition is still running when the next flush lands, so it only costs frames.
      animation: false,
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      legend: showLegend
        ? {
            show: true,
            top: 0,
            right: 8,
            data: series.map((s) => s.name),
            textStyle: { fontSize: font.sizeXs },
          }
        : { show: false },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        // Without this the tooltip rebuilds its DOM on every pointer move.
        showDelay: 0,
        hideDelay: 60,
        transitionDuration: 0,
      },
      xAxis: {
        type: "time",
        splitLine: { show: false },
        axisLabel: { hideOverlap: true, fontSize: font.sizeXs },
      },
      yAxis: {
        type: "value",
        name: yAxis?.name,
        nameTextStyle: { color: palette.textMuted, fontSize: font.sizeXs },
        min: yAxis?.min,
        max: yAxis?.max,
        scale: yAxis?.min === undefined && yAxis?.max === undefined,
      },
      // Colours the line by its own y value, so a breach is visible without a separate series.
      ...(critical !== undefined || warning !== undefined
        ? {
            visualMap: {
              show: false,
              type: "piecewise",
              seriesIndex: series.map((_, i) => i),
              dimension: 1,
              pieces: [
                ...(critical !== undefined
                  ? [{ gte: critical, color: palette.status.critical }]
                  : []),
                ...(warning !== undefined
                  ? [
                      {
                        gte: warning,
                        ...(critical !== undefined ? { lt: critical } : {}),
                        color: palette.status.warning,
                      },
                    ]
                  : []),
              ],
              outOfRange: { color: undefined },
            },
          }
        : {}),
      series: series.map((descriptor, index) => ({
        id: descriptor.key,
        name: descriptor.name,
        type: "line" as const,
        showSymbol: false,
        smooth: false,
        sampling: "lttb" as const,
        animation: false,
        lineStyle: {
          width: 1.6,
          color:
            descriptor.color ?? palette.series[index % palette.series.length],
        },
        itemStyle: {
          color:
            descriptor.color ?? palette.series[index % palette.series.length],
        },
        yAxisIndex: descriptor.yAxisIndex ?? 0,
        data: buffersRef.current.get(descriptor.key)?.toArray() ?? [],
        markLine:
          index === 0 && (warning !== undefined || critical !== undefined)
            ? {
                silent: true,
                symbol: "none",
                label: { position: "insideEndTop", fontSize: font.sizeXs },
                data: [
                  ...(warning !== undefined
                    ? [
                        {
                          yAxis: warning,
                          lineStyle: {
                            color: palette.status.warning,
                            type: "dashed" as const,
                          },
                          label: {
                            ...(thresholdLabels?.warning === undefined
                              ? { show: false }
                              : {
                                  formatter: thresholdLabels.warning(warning),
                                }),
                            color: palette.status.warning,
                          },
                        },
                      ]
                    : []),
                  ...(critical !== undefined
                    ? [
                        {
                          yAxis: critical,
                          lineStyle: {
                            color: palette.status.critical,
                            type: "dashed" as const,
                          },
                          label: {
                            ...(thresholdLabels?.critical === undefined
                              ? { show: false }
                              : {
                                  formatter: thresholdLabels.critical(critical),
                                }),
                            color: palette.status.critical,
                          },
                        },
                      ]
                    : []),
                ],
              }
            : undefined,
      })),
    };
  }, [series, theme, thresholds, yAxis, showLegend, thresholdLabels]);

  return (
    <BaseChart
      ref={chartRef}
      option={option}
      // Dropping a series from the props has to drop it from the chart too.
      notMerge
      className={className}
      style={style}
      ariaLabel={ariaLabel}
      onReady={() => {
        applyToChart();
        // Exposed so a replay or a test can feed samples without a source.
        void push;
      }}
    />
  );
};

// Fires on a level change only. Emitting per breaching sample floods listeners at the
// exact moment something is wrong.
function detectBreach(
  sample: SensorSample,
  thresholds: ThresholdConfig | undefined,
  levels: Map<string, "normal" | "warning" | "critical">,
): void {
  if (!thresholds) return;

  const { warning, critical, warningLow, criticalLow } = thresholds;
  let level: "normal" | "warning" | "critical" = "normal";
  let threshold = 0;

  if (critical !== undefined && sample.value >= critical) {
    level = "critical";
    threshold = critical;
  } else if (criticalLow !== undefined && sample.value <= criticalLow) {
    level = "critical";
    threshold = criticalLow;
  } else if (warning !== undefined && sample.value >= warning) {
    level = "warning";
    threshold = warning;
  } else if (warningLow !== undefined && sample.value <= warningLow) {
    level = "warning";
    threshold = warningLow;
  }

  const previous = levels.get(sample.sensorId) ?? "normal";
  if (previous === level) return;
  levels.set(sample.sensorId, level);
  if (level === "normal") return;

  vizEventBus.emit(VizEvent.THRESHOLD_BREACH, {
    sensorId: sample.sensorId,
    equipmentId: sample.equipmentId,
    value: sample.value,
    threshold,
    level,
    time: sample.time,
  });
}
