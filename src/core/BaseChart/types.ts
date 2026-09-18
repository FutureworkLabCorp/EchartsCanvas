import type { CSSProperties } from "react";
import type { ECharts, VizEChartsOption } from "../echarts";

export type ChartEventHandler = (params: unknown, chart: ECharts) => void;

// The union lists the names in use; the trailing `string & {}` keeps any other
// ECharts event assignable while preserving completion on the listed ones.
export type ChartEventName =
  | "click"
  | "dblclick"
  | "mouseover"
  | "mouseout"
  | "globalout"
  | "legendselectchanged"
  | "datazoom"
  | "brushselected"
  | "highlight"
  | "downplay"
  | "finished"
  | (string & {});

export interface BaseChartProps {
  option: VizEChartsOption;
  // ECharts merges by default, which leaves stale series behind when the count shrinks.
  notMerge?: boolean;
  lazyUpdate?: boolean;
  // Names the component types ECharts may drop outright rather than merge.
  replaceMerge?: string[];

  loading?: boolean;
  // Unset leaves the ECharts default; the library holds no user-facing copy of its own.
  loadingText?: string;

  themeName?: string;
  // Dirty-rect repainting. ECharts reads it only at init, so a change recreates the instance.
  useDirtyRect?: boolean;
  // Shared axis and tooltip group, via echarts.connect.
  group?: string;

  // Unbound on unmount.
  events?: Partial<Record<ChartEventName, ChartEventHandler>>;
  // zrender sits below the chart layer and still fires on empty canvas areas.
  zrEvents?: Partial<
    Record<"click" | "mousemove" | "mouseout" | "dblclick", ChartEventHandler>
  >;

  onReady?: (chart: ECharts) => void;
  onResize?: (size: { width: number; height: number }, chart: ECharts) => void;

  autoResize?: boolean;
  resizeDebounceMs?: number;

  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export interface BaseChartHandle {
  // null once unmounted.
  getInstance: () => ECharts | null;
  resize: () => void;
  // Incremental append; cheaper than setOption when only the tail changed.
  appendData: (params: { seriesIndex: number; data: unknown[] }) => void;
  toDataURL: (opts?: {
    pixelRatio?: number;
    backgroundColor?: string;
  }) => string | undefined;
  clear: () => void;
}
