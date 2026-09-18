// The whole public surface. Consumers import from here and never from a path inside
// the package, so internal files stay free to move.

import "./styles/base.css";

// --- Core Engine ------------------------------------------------------------
export { BaseChart } from "./core/BaseChart";
export type {
  BaseChartProps,
  BaseChartHandle,
  ChartEventHandler,
  ChartEventName,
} from "./core/BaseChart";

export {
  Canvas2DBase,
  hitRect,
  hitCircle,
  hitPolygon,
  pickTopMost,
  fitToViewport,
} from "./core/Canvas2DBase";
export type {
  Canvas2DBaseProps,
  Canvas2DHandle,
  Canvas2DDrawArgs,
  Canvas2DInteractionOptions,
  Point,
  Viewport,
  Rect,
  Circle,
} from "./core/Canvas2DBase";

export {
  DataStreamBuffer,
  createWebSocketSource,
  createSSESource,
  createEmitterSource,
} from "./core/DataStreamBuffer";
export type {
  DataStreamBufferOptions,
  BufferListener,
  BufferStats,
  FlushMode,
  OverflowPolicy,
  StreamSource,
  StreamStatus,
  WebSocketSourceOptions,
  SSESourceOptions,
} from "./core/DataStreamBuffer";

export { EventBus, vizEventBus, VizEvent } from "./core/EventBus";
export type { VizEventMap, VizEventName } from "./core/EventBus";

export { echarts } from "./core/echarts";
export type { ECharts, VizEChartsOption } from "./core/echarts";

export {
  RingBuffer,
  lttb,
  minMaxDownsample,
  formatTime,
  formatNumber,
  clamp,
  lerp,
} from "./core/utils";

// --- Theme ------------------------------------------------------------------
export {
  ThemeProvider,
  useVizTheme,
  useEChartsThemeName,
  useStatusColor,
  industrialDark,
  industrialLight,
  createTheme,
  buildEChartsTheme,
  registerVizTheme,
} from "./theme";
export type {
  ThemeProviderProps,
  VizTheme,
  VizThemeOverride,
  VizPalette,
  VizFont,
  VizMotion,
  StatusKey,
} from "./theme";

// --- Hooks ------------------------------------------------------------------
export {
  useResizeObserver,
  useAnimationLoop,
  useDataStream,
  useEventCallback,
} from "./hooks";
export type {
  ElementSize,
  UseResizeObserverOptions,
  FrameInfo,
  UseAnimationLoopOptions,
  AnimationLoopHandle,
  UseDataStreamOptions,
  UseDataStreamResult,
} from "./hooks";

// --- Store ------------------------------------------------------------------
export { useVizStore, useSelectedEquipmentId, useVizEvent } from "./store";
export type { VizState } from "./store";

// --- Components -------------------------------------------------------------
export {
  RealtimeStreamChart,
  OeeGauge,
  LiquidFillWidget,
} from "./components/RealtimeStreamChart";
export type {
  RealtimeStreamChartProps,
  OeeGaugeProps,
  LiquidFillWidgetProps,
} from "./components/RealtimeStreamChart";

export {
  AnomalyAnalysisChart,
  aggregateToHeatmap,
} from "./components/AnomalyAnalysisChart";
export type {
  AnomalyAnalysisChartProps,
  AnomalyChartMode,
} from "./components/AnomalyAnalysisChart";

export { FactoryLayoutCanvas } from "./components/FactoryLayoutCanvas";
export type { FactoryLayoutCanvasProps } from "./components/FactoryLayoutCanvas";

export { Panel, StatusBadge } from "./components/Panel";
export type { PanelProps, StatusBadgeProps } from "./components/Panel";

// --- Domain types -----------------------------------------------------------
export type {
  SensorSample,
  SeriesDescriptor,
  ThresholdConfig,
  TimeValuePoint,
  OeeMetrics,
  AnomalyPoint,
  PredictionBandPoint,
  TimeRange,
  HeatmapCell,
  EquipmentNode,
  EquipmentStatus,
  LayoutZone,
  ConveyorPath,
  FactoryLayout,
} from "./types/domain";

export {
  createMockSensorStream,
  MockWebSocket,
  createMockAnomalyDataset,
  createMockFactoryLayout,
  simulateStatusChanges,
  createRandom,
} from "./mock";
export type {
  MockSensorConfig,
  MockSensorStreamOptions,
  MockSensorStream,
  MockAnomalyOptions,
  MockAnomalyDataset,
} from "./mock";
