import type { ComposeOption } from "echarts/core";
import type {
  CustomSeriesOption,
  EffectScatterSeriesOption,
  GaugeSeriesOption,
  HeatmapSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  ScatterSeriesOption,
} from "echarts/charts";
import type {
  DataZoomComponentOption,
  DatasetComponentOption,
  GraphicComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  ToolboxComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from "echarts/components";

// Narrowed to what core/echarts actually registers, so reaching for an unregistered
// series fails to compile instead of rendering nothing at runtime.
export type VizEChartsOption = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | EffectScatterSeriesOption
  | HeatmapSeriesOption
  | GaugeSeriesOption
  | PieSeriesOption
  | CustomSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | TitleComponentOption
  | DataZoomComponentOption
  | VisualMapComponentOption
  | ToolboxComponentOption
  | GraphicComponentOption
  | DatasetComponentOption
>;

export type VizSeriesOption = NonNullable<VizEChartsOption["series"]>;
