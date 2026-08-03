import type {
  AnomalyPoint,
  EquipmentNode,
  TimeRange,
} from "../../types/domain";

/** 대시보드 공통 이벤트 이름 */
export const VizEvent = {
  EQUIPMENT_SELECT: "ON_EQUIPMENT_SELECT",
  EQUIPMENT_HOVER: "ON_EQUIPMENT_HOVER",
  TIME_RANGE_CHANGE: "ON_TIME_RANGE_CHANGE",
  ANOMALY_SELECT: "ON_ANOMALY_SELECT",
  THRESHOLD_BREACH: "ON_THRESHOLD_BREACH",
  STREAM_STATUS: "ON_STREAM_STATUS",
} as const;

export type VizEventName = (typeof VizEvent)[keyof typeof VizEvent];

/**
 * 이벤트 이름 → 페이로드 타입 매핑.
 * 컴포넌트 간 계약이므로 payload 를 확장할 때는 이 맵을 먼저 수정한다.
 */
export interface VizEventMap {
  ON_EQUIPMENT_SELECT: { equipment: EquipmentNode | null; source?: string };
  ON_EQUIPMENT_HOVER: { equipment: EquipmentNode | null; source?: string };
  ON_TIME_RANGE_CHANGE: { range: TimeRange; source?: string };
  ON_ANOMALY_SELECT: { anomaly: AnomalyPoint; source?: string };
  ON_THRESHOLD_BREACH: {
    sensorId: string;
    equipmentId?: string;
    value: number;
    threshold: number;
    level: "warning" | "critical";
    time: number;
  };
  ON_STREAM_STATUS: {
    channel: string;
    status: "connecting" | "open" | "closed" | "error";
  };
}
