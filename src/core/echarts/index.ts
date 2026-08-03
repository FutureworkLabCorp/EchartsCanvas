/**
 * ECharts 코어 등록 지점.
 *
 * 전체 `echarts` 번들을 import 하지 않고 필요한 차트/컴포넌트/렌더러만 등록한다.
 * - 렌더러는 Canvas 로 고정한다(대용량 실시간 데이터에서 SVG 대비 유리).
 * - 라이브러리 전체가 **이 모듈이 export 하는 단일 echarts 인스턴스**만 사용해야 한다.
 *   (`echarts` 와 `echarts/core` 를 혼용하면 인스턴스가 두 벌 생성되어 테마/등록이 깨진다.)
 */
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
