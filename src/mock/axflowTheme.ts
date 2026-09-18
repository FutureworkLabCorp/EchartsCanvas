import { createTheme, industrialLight } from "../theme/presets";
import type { VizTheme } from "../theme/types";
import type { GraphTypeStyle } from "../types/domain";

// Values copied from the axflow app's `@theme` block so the demo and the stories read as
// the product rather than as a library sample. They are literals here only because the
// token bridge that would resolve them from the host's CSS does not exist yet; a real
// consumer passes its own resolved values and never reaches for this file.

const N = {
  n0: "#ffffff",
  n50: "#f9f9fb",
  n75: "#ededf3",
  n100: "#e8e8ee",
  n200: "#dadae0",
  n400: "#aeaeb2",
  n500: "#8e8e93",
  n600: "#636366",
  n700: "#48484a",
  n900: "#1d1d1f",
} as const;

const STATUS = {
  error: "#f04438",
  warning: "#fac515",
  info: "#444ce7",
  success: "#15b79e",
  caution: "#d9b80e",
  pointGreen: "#00e29e",
  pointViolet: "#6f36ff",
} as const;

export const axflowLight: VizTheme = createTheme(industrialLight, {
  name: "axflow-light",
  radius: 12,
  font: {
    family:
      "'Pretendard GOV', 'Pretendard', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  palette: {
    background: N.n50,
    surface: N.n0,
    surfaceAlt: N.n75,
    border: N.n200,
    // --color-kg-edge-idle. Alpha rather than a flat grey, so edges stay behind the cards.
    gridLine: "rgba(0, 0, 0, 0.1)",
    axisLine: N.n400,

    textPrimary: N.n900,
    textSecondary: N.n700,
    textMuted: N.n600,

    // --color-data-1 and --color-data-2, then the remaining brand colours.
    series: [
      STATUS.pointGreen,
      STATUS.pointViolet,
      STATUS.info,
      STATUS.success,
      STATUS.warning,
      STATUS.error,
      N.n600,
      STATUS.caution,
    ],
    status: {
      normal: STATUS.success,
      warning: STATUS.warning,
      critical: STATUS.error,
      idle: STATUS.info,
      offline: N.n500,
      maintenance: STATUS.pointViolet,
    },

    accent: STATUS.pointViolet,
    thresholdWarning: "rgba(250, 197, 21, 0.14)",
    thresholdCritical: "rgba(240, 68, 56, 0.14)",
    predictionBand: "rgba(111, 54, 255, 0.12)",

    tooltipBackground: "rgba(255, 255, 255, 0.98)",
    tooltipBorder: N.n200,
  },
});

// The --color-kg-node-* family, in the same order the product's legend lists it.
export const axflowGraphTypeStyles: Record<string, GraphTypeStyle> = {
  ISSUE: { label: "이슈", color: STATUS.error, icon: "alert" },
  EQUIPMENT: { label: "장비", color: STATUS.pointViolet, icon: "gear" },
  PROCESS: { label: "공정", color: STATUS.warning, icon: "flow" },
  MATERIAL: { label: "원자재", color: STATUS.info, icon: "layers" },
  DOCUMENT: { label: "문서", color: STATUS.success, icon: "doc" },
  WORKER: { label: "작업자", color: N.n600, icon: "person" },
};
