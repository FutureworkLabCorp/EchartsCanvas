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
  /** 표시할 시리즈 정의. key 는 SensorSample.sensorId 와 매칭된다. */
  series: SeriesDescriptor[];
  /** 스트림 소스(WebSocket/SSE/Mock). 함수로 주면 마운트 시 1회만 생성한다. */
  source?:
    | StreamSource<SensorSample>
    | (() => StreamSource<SensorSample>)
    | null;
  /** 시리즈별 유지 포인트 수(기본 600). 초과분은 링버퍼에서 자동 폐기된다. */
  windowSize?: number;
  /** 버퍼 flush 주기(ms). 값이 클수록 CPU 사용량이 낮아진다. */
  flushInterval?: number;
  /** 임계치. 초과 구간은 visualMap 으로 색이 바뀌고 ON_THRESHOLD_BREACH 가 발행된다. */
  thresholds?: ThresholdConfig;
  /** 지정 시 해당 설비의 샘플만 수집한다(설비 선택 연동). */
  equipmentId?: string | null;
  /** true 면 유입은 계속 버퍼링하되 차트 갱신을 멈춘다. */
  paused?: boolean;
  yAxis?: { min?: number; max?: number; name?: string };
  /** 초기 데이터(이력 프리로드) */
  initialData?: SensorSample[];
  showLegend?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * 실시간 스트리밍 모니터링 차트.
 *
 * 성능 설계
 * - 수신 → `DataStreamBuffer`(throttle) → 링버퍼 → `setOption` 을 flush 주기당 1회만 수행한다.
 * - 데이터는 React state 가 아닌 ref(RingBuffer)에 보관해 초당 수백 건 유입에도 리렌더가 발생하지 않는다.
 * - `sampling: 'lttb'` 로 포인트 수가 픽셀 수를 넘어도 렌더 비용이 선형으로 늘지 않는다.
 */
export function RealtimeStreamChart({
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
  className,
  style,
}: RealtimeStreamChartProps) {
  const theme = useVizTheme();
  const chartRef = useRef<BaseChartHandle>(null);
  const buffersRef = useRef(new Map<string, RingBuffer<TimeValuePoint>>());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const equipmentRef = useRef(equipmentId);
  equipmentRef.current = equipmentId;
  /** 임계치 재진입 시에만 이벤트를 발행하기 위한 직전 레벨 기록 */
  const breachLevelRef = useRef(
    new Map<string, "normal" | "warning" | "critical">(),
  );

  // 시리즈 구성이 바뀌면 링버퍼를 재구성한다.
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

    // notMerge 없이 id 매칭으로 data 만 교체한다 → 축·툴팁 등 재계산 최소화
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

  // 이력 프리로드
  useEffect(() => {
    if (!initialData?.length) return;
    for (const sample of initialData) pushSample(sample);
    applyToChart();
  }, [initialData, pushSample, applyToChart]);

  // 일시정지 해제 시 밀린 데이터를 즉시 반영
  useEffect(() => {
    if (!paused) applyToChart();
  }, [paused, applyToChart]);

  const option = useMemo<VizEChartsOption>(() => {
    const { palette, font } = theme;
    const critical = thresholds?.critical;
    const warning = thresholds?.warning;

    return {
      animation: false, // 실시간 갱신에서는 전환 애니메이션이 프레임 예산을 잡아먹는다
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
        // 마우스 이동마다 DOM 을 갱신하지 않도록 지연을 준다
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
      // 임계치 구간 색상 매핑: 값 자체를 기준으로 선 색을 바꾼다.
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
                            formatter: `주의 ${warning}`,
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
                            formatter: `경고 ${critical}`,
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
  }, [series, theme, thresholds, yAxis, showLegend]);

  return (
    <BaseChart
      ref={chartRef}
      option={option}
      // 시리즈 정의가 바뀔 때는 이전 시리즈를 남기지 않는다.
      notMerge
      className={className}
      style={style}
      ariaLabel="실시간 센서 스트리밍 차트"
      onReady={() => {
        applyToChart();
        // 외부에서 수동 주입할 수 있도록 push 를 노출(리플레이·테스트용)
        void push;
      }}
    />
  );
}

/** 임계치 상태가 바뀌는 순간에만 이벤트를 발행한다(매 샘플 발행 시 이벤트 폭주). */
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
