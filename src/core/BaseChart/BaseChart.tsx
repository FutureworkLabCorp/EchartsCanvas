import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import { echarts } from "../echarts";
import type { ECharts } from "../echarts";
import { useEChartsThemeName, useVizTheme } from "../../theme/ThemeProvider";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import { useEventCallback } from "../../hooks/useEventCallback";
import type { BaseChartHandle, BaseChartProps } from "./types";

// The single place echarts.init is called. Nothing else may call it, because the
// teardown, theme rebuild, resize and event unbinding below only cover instances
// this wrapper owns, and an unattended dashboard runs for days on that guarantee.
//
// ECharts cannot swap a theme on a live instance, so a theme change recreates it.
export const BaseChart = ({
  ref,
  option,
  notMerge = false,
  lazyUpdate = true,
  replaceMerge,
  loading = false,
  loadingText,
  themeName,
  useDirtyRect = true,
  group,
  events,
  zrEvents,
  onReady,
  onResize,
  autoResize = true,
  resizeDebounceMs = 0,
  className,
  style,
  ariaLabel,
}: BaseChartProps & { ref?: Ref<BaseChartHandle> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const theme = useVizTheme();
  const providerThemeName = useEChartsThemeName();
  const resolvedTheme = themeName ?? providerThemeName;

  const handleReady = useEventCallback(onReady);
  const handleResize = useEventCallback(onResize);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, resolvedTheme, {
      renderer: "canvas",
      useDirtyRect,
    });
    chartRef.current = chart;
    handleReady(chart);

    return () => {
      chartRef.current = null;
      // Releases the internal rAF, listeners and canvas context. Skipping it leaks a
      // little on every remount, which adds up over a day-long session.
      chart.dispose();
    };
  }, [resolvedTheme, useDirtyRect, handleReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !group) return;

    chart.group = group;
    echarts.connect(group);
    return () => {
      // Leaving the group set lets echarts.connect keep reaching a disposed instance.
      chart.group = "";
    };
  }, [group, resolvedTheme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed()) return;

    chart.setOption(option, {
      notMerge,
      lazyUpdate,
      ...(replaceMerge ? { replaceMerge } : {}),
    });
  }, [option, notMerge, lazyUpdate, replaceMerge]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed()) return;

    if (loading) {
      chart.showLoading("default", {
        // Omitted rather than defaulted: the library ships no user-facing copy, so an
        // unset label falls through to the ECharts default.
        ...(loadingText === undefined ? {} : { text: loadingText }),
        color: theme.palette.accent,
        textColor: theme.palette.textSecondary,
        maskColor: "transparent",
        zlevel: 0,
        fontFamily: theme.font.family,
        fontSize: theme.font.sizeSm,
      });
    } else {
      chart.hideLoading();
    }
  }, [loading, loadingText, theme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed() || !events) return;

    const entries = Object.entries(events).filter(
      (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
        typeof entry[1] === "function",
    );

    const bound = entries.map(([name, handler]) => {
      const listener = (params: unknown) => handler(params, chart);
      chart.on(name, listener);
      return { name, listener };
    });

    return () => {
      if (chart.isDisposed()) return;
      for (const { name, listener } of bound) chart.off(name, listener);
    };
  }, [events, resolvedTheme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed() || !zrEvents) return;

    const zr = chart.getZr();
    const bound = Object.entries(zrEvents)
      .filter(
        (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
          typeof entry[1] === "function",
      )
      .map(([name, handler]) => {
        const listener = (params: unknown) => handler(params, chart);
        zr.on(name, listener);
        return { name, listener };
      });

    return () => {
      if (chart.isDisposed()) return;
      for (const { name, listener } of bound) zr.off(name, listener);
    };
  }, [zrEvents, resolvedTheme]);

  useResizeObserver(
    containerRef,
    (size) => {
      const chart = chartRef.current;
      if (!chart || chart.isDisposed()) return;
      // A hidden container reports 0x0; resizing to that loses the chart layout.
      if (size.width === 0 || size.height === 0) return;

      chart.resize({ width: size.width, height: size.height });
      handleResize(size, chart);
    },
    { debounceMs: resizeDebounceMs, enabled: autoResize },
  );

  useImperativeHandle(
    ref,
    (): BaseChartHandle => ({
      getInstance: () => chartRef.current,
      resize: () => {
        const chart = chartRef.current;
        if (chart && !chart.isDisposed()) chart.resize();
      },
      appendData: (params) => {
        const chart = chartRef.current;
        if (chart && !chart.isDisposed()) {
          chart.appendData(params as Parameters<ECharts["appendData"]>[0]);
        }
      },
      toDataURL: (opts) => {
        const chart = chartRef.current;
        if (!chart || chart.isDisposed()) return undefined;
        return chart.getDataURL({ type: "png", pixelRatio: 2, ...opts });
      },
      clear: () => {
        const chart = chartRef.current;
        if (chart && !chart.isDisposed()) chart.clear();
      },
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className={["viz-chart-root", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
      style={style}
    />
  );
};
