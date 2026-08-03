import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { echarts } from "../echarts";
import type { ECharts } from "../echarts";
import { useEChartsThemeName, useVizTheme } from "../../theme/ThemeProvider";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import { useEventCallback } from "../../hooks/useEventCallback";
import type { BaseChartHandle, BaseChartProps } from "./types";

/**
 * 모든 ECharts 기반 컴포넌트의 공통 래퍼.
 *
 * 책임
 * 1. 인스턴스 생성/파기: 언마운트 시 `dispose()` 를 보장한다.
 * 2. 테마: ThemeProvider 의 테마를 자동 적용하고, 테마가 바뀌면 인스턴스를 재생성한다
 *    (ECharts 는 생성 후 테마 교체를 지원하지 않는다).
 * 3. 반응형: ResizeObserver 로 컨테이너 크기 변화를 감지해 `resize()` 를 호출한다.
 * 4. 이벤트: props 로 받은 핸들러를 등록하고 해제 시 모두 off 한다.
 *
 * 이 래퍼를 거치지 않고 echarts.init 을 직접 호출하는 코드는 만들지 않는다.
 */
export const BaseChart = forwardRef<BaseChartHandle, BaseChartProps>(
  function BaseChart(
    {
      option,
      notMerge = false,
      lazyUpdate = true,
      replaceMerge,
      loading = false,
      loadingText = "데이터를 불러오는 중…",
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
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ECharts | null>(null);
    const theme = useVizTheme();
    const providerThemeName = useEChartsThemeName();
    const resolvedTheme = themeName ?? providerThemeName;

    const handleReady = useEventCallback(onReady);
    const handleResize = useEventCallback(onResize);

    // 1) 인스턴스 라이프사이클 -------------------------------------------------
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
        // 내부 rAF·이벤트·Canvas 컨텍스트를 모두 해제한다. 누락 시 24시간 구동에서 누수가 누적된다.
        chart.dispose();
      };
    }, [resolvedTheme, useDirtyRect, handleReady]);

    // 2) 차트 그룹(축·툴팁 연동) ------------------------------------------------
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || !group) return;

      chart.group = group;
      echarts.connect(group);
      return () => {
        // 그룹에서 제외. 남겨두면 dispose 된 인스턴스를 참조할 수 있다.
        chart.group = "";
      };
    }, [group, resolvedTheme]);

    // 3) 옵션 반영 -------------------------------------------------------------
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || chart.isDisposed()) return;

      chart.setOption(option, {
        notMerge,
        lazyUpdate,
        ...(replaceMerge ? { replaceMerge } : {}),
      });
    }, [option, notMerge, lazyUpdate, replaceMerge]);

    // 4) 로딩 상태 -------------------------------------------------------------
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || chart.isDisposed()) return;

      if (loading) {
        chart.showLoading("default", {
          text: loadingText,
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

    // 5) 이벤트 바인딩 ---------------------------------------------------------
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

    // 6) 반응형 ----------------------------------------------------------------
    useResizeObserver(
      containerRef,
      (size) => {
        const chart = chartRef.current;
        if (!chart || chart.isDisposed()) return;
        if (size.width === 0 || size.height === 0) return; // 숨김 상태에서의 0 크기 resize 무시

        chart.resize({ width: size.width, height: size.height });
        handleResize(size, chart);
      },
      { debounceMs: resizeDebounceMs, enabled: autoResize },
    );

    // 7) 명령형 핸들 -----------------------------------------------------------
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
  },
);
