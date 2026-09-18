// Shared by the ECharts themes and the Canvas renderers, so one status maps to one colour
// no matter which engine drew it.
export type StatusKey =
  "normal" | "warning" | "critical" | "idle" | "offline" | "maintenance";

export interface VizPalette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  gridLine: string;
  axisLine: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Assigned to categorical series in order, wrapping when they run out.
  series: string[];
  status: Record<StatusKey, string>;

  accent: string;
  thresholdWarning: string;
  thresholdCritical: string;
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
  // Tabular figures so KPI digits stop shifting as values change.
  monoFamily: string;
}

export interface VizMotion {
  pulseDuration: number;
  // ECharts transition length. Keep it near zero on live charts, where a transition
  // is still running when the next frame of data lands.
  chartAnimationDuration: number;
}

export interface VizTheme {
  // Doubles as the echarts.registerTheme key, so it has to be unique per theme.
  name: string;
  dark: boolean;
  palette: VizPalette;
  font: VizFont;
  motion: VizMotion;
  radius: number;
}

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
