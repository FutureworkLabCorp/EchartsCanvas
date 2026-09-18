import type { EquipmentStatus } from "../types/domain";
import type { StatusKey } from "../theme/types";

// Sample copy for the demo app and the stories, not the library's own wording. The
// components take every user-facing string as a prop precisely so a consumer supplies
// its own; these exist so a story does not have to spell out six status names inline.

export const koStatusLabels: Record<StatusKey, string> = {
  normal: "정상",
  warning: "주의",
  critical: "경고",
  idle: "대기",
  offline: "오프라인",
  maintenance: "점검중",
};

// Longer than koStatusLabels because the layout tooltip has room for the reason, while
// a badge does not.
export const koEquipmentStatusLabels: Record<EquipmentStatus, string> = {
  normal: "정상 가동",
  warning: "주의 — 지표 이탈",
  critical: "경고 — 즉시 확인",
  idle: "대기",
  offline: "오프라인",
  maintenance: "정비 중",
};

export const koAnomalyChartLabels = {
  actual: "실측값",
  predictionBand: "예측 정상범위",
  predicted: "AI 예측값",
  anomaly: "이상 감지",
};

export const koToolboxLabels = {
  zoom: "영역 확대",
  back: "되돌리기",
  restore: "초기화",
  saveAsImage: "이미지 저장",
};

export const koThresholdLabels = {
  warning: (value: number) => `주의 ${value}`,
  critical: (value: number) => `경고 ${value}`,
};

export const koHourLabel = (hour: number): string => `${hour}시`;
