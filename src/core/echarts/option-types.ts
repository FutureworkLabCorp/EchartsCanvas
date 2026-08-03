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

/**
 * 이 프레임워크에서 사용 가능한 옵션만 허용하는 엄격 타입.
 * 등록하지 않은 series 를 실수로 사용하면 컴파일 타임에 막힌다.
 */
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
