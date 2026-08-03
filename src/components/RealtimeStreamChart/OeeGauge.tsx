import { useMemo } from "react";
import type { CSSProperties } from "react";
import { BaseChart } from "../../core/BaseChart/BaseChart";
import type { VizEChartsOption } from "../../core/echarts";
import { useVizTheme } from "../../theme/ThemeProvider";
import { clamp } from "../../core/utils/format";
import type { OeeMetrics } from "../../types/domain";

export interface OeeGaugeProps {
  /** 가동률·성능·양품률. OEE = 세 값의 곱 */
  metrics: OeeMetrics;
  /** 주의/경고 임계(0~1). 게이지 색이 바뀐다. */
  warningBelow?: number;
  criticalBelow?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/** OEE(종합설비효율) 게이지. RealtimeStreamChart 와 나란히 배치하는 KPI 위젯. */
export function OeeGauge({
  metrics,
  warningBelow = 0.75,
  criticalBelow = 0.6,
  title = "OEE",
  className,
  style,
}: OeeGaugeProps) {
  const theme = useVizTheme();

  const option = useMemo<VizEChartsOption>(() => {
    const { palette, font } = theme;
    const oee = clamp(
      metrics.availability * metrics.performance * metrics.quality,
      0,
      1,
    );
    const color =
      oee < criticalBelow
        ? palette.status.critical
        : oee < warningBelow
          ? palette.status.warning
          : palette.status.normal;

    return {
      series: [
        {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          radius: "92%",
          center: ["50%", "58%"],
          progress: { show: true, width: 12, itemStyle: { color } },
          pointer: { show: false },
          axisLine: {
            lineStyle: { width: 12, color: [[1, palette.gridLine]] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: {
            show: true,
            offsetCenter: [0, "28%"],
            color: palette.textSecondary,
            fontSize: font.sizeXs,
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, "-4%"],
            formatter: (value: number) => `${value.toFixed(1)}%`,
            color: palette.textPrimary,
            fontFamily: font.monoFamily,
            fontSize: 26,
            fontWeight: 600,
          },
          data: [{ value: Number((oee * 100).toFixed(1)), name: title }],
        },
      ],
    };
  }, [metrics, theme, title, warningBelow, criticalBelow]);

  return (
    <BaseChart
      option={option}
      notMerge
      className={className}
      style={style}
      ariaLabel={`${title} 게이지`}
    />
  );
}
