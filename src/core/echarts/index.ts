// Registers only the charts, components and renderer this library uses, so the full
// ECharts bundle never reaches a consumer. Canvas is the only renderer registered:
// SVG loses to it well before the point counts these charts carry.
//
// Everything must import the instance this module exports. Mixing it with a bare
// `echarts` import builds a second instance, and themes registered on one are
// invisible to the other.
import * as echarts from "echarts/core";

import {
  CustomChart,
  EffectScatterChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
} from "echarts/charts";

import {
  DataZoomComponent,
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from "echarts/components";

import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  // charts
  LineChart,
  ScatterChart,
  EffectScatterChart,
  HeatmapChart,
  GaugeChart,
  PieChart,
  CustomChart,
  // components
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkAreaComponent,
  MarkPointComponent,
  MarkLineComponent,
  ToolboxComponent,
  GraphicComponent,
  DatasetComponent,
  TransformComponent,
  // features
  LabelLayout,
  UniversalTransition,
  // renderer
  CanvasRenderer,
]);

export { echarts };
export type { ECharts, EChartsCoreOption } from "echarts/core";
export type { VizEChartsOption } from "./option-types";
