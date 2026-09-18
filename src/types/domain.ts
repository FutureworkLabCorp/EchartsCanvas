import type { StatusKey } from "../theme/types";

export type EquipmentStatus = StatusKey;

export interface SensorSample {
  // epoch millis
  time: number;
  sensorId: string;
  value: number;
  equipmentId?: string;
  quality?: "good" | "uncertain" | "bad";
}

export type TimeValuePoint = [number, number];

export interface SeriesDescriptor {
  // Matches SensorSample.sensorId.
  key: string;
  name: string;
  unit?: string;
  color?: string;
  yAxisIndex?: number;
}

export interface ThresholdConfig {
  warning?: number;
  critical?: number;
  // Falling below a low bound counts as an anomaly the same way exceeding a high one does.
  warningLow?: number;
  criticalLow?: number;
}

// All three are ratios in 0..1.
export interface OeeMetrics {
  availability: number;
  performance: number;
  quality: number;
}

export interface AnomalyPoint {
  time: number;
  value: number;
  // 0..1
  score: number;
  label?: string;
  severity?: "warning" | "critical";
  equipmentId?: string;
}

export interface PredictionBandPoint {
  time: number;
  lower: number;
  upper: number;
  // Model median, not the midpoint of lower/upper.
  predicted?: number;
}

export interface TimeRange {
  start: number;
  end: number;
  label?: string;
  severity?: "info" | "warning" | "critical";
}

export interface HeatmapCell {
  // x is the time-bucket index, y the category index — neither is a value.
  x: number;
  y: number;
  value: number;
}

export interface EquipmentNode {
  id: string;
  name: string;
  // World coordinates, not screen pixels.
  x: number;
  y: number;
  width: number;
  height: number;
  status: EquipmentStatus;
  // degrees
  rotation?: number;
  type?: string;
  metrics?: Record<string, number | string>;
}

export interface LayoutZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface ConveyorPath {
  id: string;
  points: Array<{ x: number; y: number }>;
  // 1 forward, -1 reverse, 0 stopped.
  direction?: 1 | -1 | 0;
}

export interface FactoryLayout {
  // World size, not pixels.
  width: number;
  height: number;
  // Has to resolve without the network: a bundled or app-served asset, never a remote URL.
  backgroundImage?: string;
  // World units; 0 hides the grid.
  gridSize?: number;
  zones?: LayoutZone[];
  conveyors?: ConveyorPath[];
  equipments: EquipmentNode[];
}
