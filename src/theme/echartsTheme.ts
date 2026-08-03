import { echarts } from "../core/echarts";
import type { VizTheme } from "./types";

/** VizTheme → ECharts 테마 객체 변환 */
export function buildEChartsTheme(theme: VizTheme): Record<string, unknown> {
  const { palette, font } = theme;

  const axisCommon = {
    axisLine: { show: true, lineStyle: { color: palette.axisLine } },
    axisTick: { show: false },
    axisLabel: {
      color: palette.textSecondary,
      fontSize: font.sizeXs,
      fontFamily: font.family,
    },
    splitLine: {
      show: true,
      lineStyle: { color: palette.gridLine, type: "solid" },
    },
    splitArea: { show: false },
  };

  return {
    color: palette.series,
    backgroundColor: "transparent",
    textStyle: { fontFamily: font.family, color: palette.textPrimary },

    title: {
      textStyle: {
        color: palette.textPrimary,
        fontSize: font.sizeLg,
        fontWeight: 600,
      },
      subtextStyle: { color: palette.textMuted, fontSize: font.sizeSm },
    },
    legend: {
      textStyle: { color: palette.textSecondary, fontSize: font.sizeSm },
      inactiveColor: palette.textMuted,
      itemWidth: 10,
      itemHeight: 10,
      icon: "roundRect",
    },
    tooltip: {
      backgroundColor: palette.tooltipBackground,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: palette.textPrimary, fontSize: font.sizeSm },
      axisPointer: {
        lineStyle: { color: palette.accent, width: 1, type: "dashed" },
        crossStyle: { color: palette.accent },
        label: {
          backgroundColor: palette.surfaceAlt,
          color: palette.textPrimary,
        },
      },
    },
    grid: {
      left: 48,
      right: 24,
      top: 32,
      bottom: 32,
      containLabel: true,
      borderColor: palette.border,
    },
    categoryAxis: { ...axisCommon, splitLine: { show: false } },
    valueAxis: axisCommon,
    timeAxis: axisCommon,
    logAxis: axisCommon,

    line: {
      symbol: "none",
      smooth: false,
      lineStyle: { width: 1.5 },
      // 실시간 스트리밍에서 샘플링 비용을 줄인다.
      sampling: "lttb",
    },
    scatter: { symbolSize: 6 },
    heatmap: {
      itemStyle: { borderColor: palette.background, borderWidth: 0.5 },
    },
    gauge: {
      axisLine: { lineStyle: { color: [[1, palette.gridLine]] } },
      axisLabel: { color: palette.textMuted },
      title: { color: palette.textSecondary },
      detail: { color: palette.textPrimary, fontFamily: font.monoFamily },
    },

    dataZoom: {
      backgroundColor: "transparent",
      dataBackground: {
        lineStyle: { color: palette.axisLine },
        areaStyle: { color: palette.surfaceAlt },
      },
      selectedDataBackground: {
        lineStyle: { color: palette.accent },
        areaStyle: { color: palette.predictionBand },
      },
      fillerColor: palette.predictionBand,
      borderColor: palette.border,
      handleStyle: { color: palette.surfaceAlt, borderColor: palette.axisLine },
      moveHandleStyle: { color: palette.axisLine },
      textStyle: { color: palette.textMuted, fontSize: font.sizeXs },
      emphasis: {
        handleStyle: { borderColor: palette.accent },
        moveHandleStyle: { color: palette.accent },
      },
    },
    visualMap: {
      textStyle: { color: palette.textSecondary, fontSize: font.sizeXs },
    },
    toolbox: {
      iconStyle: { borderColor: palette.textMuted },
      emphasis: { iconStyle: { borderColor: palette.accent } },
    },
    markPoint: {
      label: { color: palette.background },
    },
    animationDuration: theme.motion.chartAnimationDuration,
    animationDurationUpdate: theme.motion.chartAnimationDuration,
  };
}

const registered = new Set<string>();

/**
 * ECharts 전역 테마 레지스트리에 등록한다.
 * 동일 이름으로 재등록하면 덮어쓰며, 이미 생성된 인스턴스에는 반영되지 않는다
 * (BaseChart 가 테마 변경 시 인스턴스를 재생성한다).
 */
export function registerVizTheme(theme: VizTheme): string {
  echarts.registerTheme(theme.name, buildEChartsTheme(theme));
  registered.add(theme.name);
  return theme.name;
}

export function isThemeRegistered(name: string): boolean {
  return registered.has(name);
}
