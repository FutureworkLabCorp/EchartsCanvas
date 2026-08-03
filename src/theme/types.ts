/** 설비/센서 상태 코드. Canvas·ECharts 양쪽에서 동일한 색 매핑을 공유한다. */
export type StatusKey =
  | "normal"
  | "warning"
  | "critical"
  | "idle"
  | "offline"
  | "maintenance";

export interface VizPalette {
  /** 대시보드 최외곽 배경 */
  background: string;
  /** 카드/패널 표면 */
  surface: string;
  /** 패널 내 강조 표면(툴바, 헤더) */
  surfaceAlt: string;
  border: string;
  /** 차트 그리드 라인 */
  gridLine: string;
  /** 축 라인 */
  axisLine: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  /** 카테고리 시리즈 팔레트(순서대로 배정) */
  series: string[];
  /** 상태 색상 */
  status: Record<StatusKey, string>;

  accent: string;
  /** 임계치 초과 영역 표시용 */
  thresholdWarning: string;
  thresholdCritical: string;
  /** 예측 정상 범위 밴드 */
  predictionBand: string;

  tooltipBackground: string;
  tooltipBorder: string;
}

export interface VizFont {
  family: string;
  sizeXs: number;
  sizeSm: number;
  sizeMd: number;
  sizeLg: number;
  /** 숫자 정렬이 필요한 KPI 영역용 */
  monoFamily: string;
}

export interface VizMotion {
  /** 상태 Pulse 애니메이션 주기(ms) */
  pulseDuration: number;
  /** ECharts 전환 애니메이션(ms). 실시간 차트에서는 0 에 가깝게 둔다. */
  chartAnimationDuration: number;
}

export interface VizTheme {
  /** echarts.registerTheme 에 사용되는 고유 키 */
  name: string;
  dark: boolean;
  palette: VizPalette;
  font: VizFont;
  motion: VizMotion;
  radius: number;
}

/** 프리셋 위에 부분 덮어쓰기로 커스텀 테마를 만들 때 사용하는 타입 */
export interface VizThemeOverride {
  name: string;
  dark?: boolean;
  palette?: Partial<Omit<VizPalette, "status">> & {
    status?: Partial<VizPalette["status"]>;
  };
  font?: Partial<VizFont>;
  motion?: Partial<VizMotion>;
  radius?: number;
}
