import type { StatusKey } from "../theme/types";

/** 설비 상태 코드(테마 색상 키와 1:1 대응) */
export type EquipmentStatus = StatusKey;

/** 고주파 센서 1건 */
export interface SensorSample {
  /** epoch millis */
  time: number;
  /** 센서(시리즈) 식별자 */
  sensorId: string;
  value: number;
  /** 소속 설비. 이벤트 연동 시 필터 키로 사용 */
  equipmentId?: string;
  quality?: "good" | "uncertain" | "bad";
}

/** 차트에 주입되는 [x, y] 튜플 */
export type TimeValuePoint = [number, number];

export interface SeriesDescriptor {
  /** SensorSample.sensorId 와 매칭되는 키 */
  key: string;
  name: string;
  unit?: string;
  color?: string;
  /** 개별 시리즈 y축 인덱스(다축 구성 시) */
  yAxisIndex?: number;
}

export interface ThresholdConfig {
  warning?: number;
  critical?: number;
  /** 하한 임계치(하한 이탈도 이상으로 간주) */
  warningLow?: number;
  criticalLow?: number;
}

/** OEE 지표 */
export interface OeeMetrics {
  /** 가동률 0~1 */
  availability: number;
  /** 성능 0~1 */
  performance: number;
  /** 양품률 0~1 */
  quality: number;
}

// --- 이상 탐지 ---------------------------------------------------------------

export interface AnomalyPoint {
  time: number;
  value: number;
  /** 이상 점수 0~1 */
  score: number;
  label?: string;
  severity?: "warning" | "critical";
  equipmentId?: string;
}

export interface PredictionBandPoint {
  time: number;
  /** 예측 정상 범위 하한/상한 */
  lower: number;
  upper: number;
  /** 모델 예측 중앙값 */
  predicted?: number;
}

/** 시간 구간 강조(MarkArea) */
export interface TimeRange {
  start: number;
  end: number;
  label?: string;
  severity?: "info" | "warning" | "critical";
}

/** Heatmap 전환용 셀 (x: 시간 버킷 인덱스, y: 카테고리 인덱스) */
export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
}

// --- 공장 레이아웃 -----------------------------------------------------------

export interface EquipmentNode {
  id: string;
  name: string;
  /** 도면(월드) 좌표계 기준 위치·크기 */
  x: number;
  y: number;
  width: number;
  height: number;
  status: EquipmentStatus;
  /** 회전각(도) */
  rotation?: number;
  type?: string;
  /** 툴팁/패널에 노출할 부가 지표 */
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
  /** 흐름 애니메이션 방향 (1: 정방향, -1: 역방향, 0: 정지) */
  direction?: 1 | -1 | 0;
}

export interface FactoryLayout {
  /** 도면 논리 크기(월드 좌표) */
  width: number;
  height: number;
  /** 배경 평면도 이미지 URL(선택) */
  backgroundImage?: string;
  /** 격자 간격(월드 단위). 0 이면 격자 미표시 */
  gridSize?: number;
  zones?: LayoutZone[];
  conveyors?: ConveyorPath[];
  equipments: EquipmentNode[];
}
