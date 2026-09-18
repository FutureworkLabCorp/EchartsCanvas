import type { VizTheme, VizThemeOverride } from "./types";

const font = {
  family:
    "'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  monoFamily:
    "'JetBrains Mono', 'D2Coding', ui-monospace, SFMono-Regular, Menlo, monospace",
  sizeXs: 11,
  sizeSm: 12,
  sizeMd: 14,
  sizeLg: 18,
} as const;

// Control room and shop-floor kiosk default. Desaturated surfaces against saturated
// status colours, so an operator staring at it for a shift still reads status at a glance.
export const industrialDark: VizTheme = {
  name: "industrial-dark",
  dark: true,
  radius: 8,
  font: { ...font },
  motion: {
    pulseDuration: 1600,
    chartAnimationDuration: 240,
  },
  palette: {
    background: "#0b1017",
    surface: "#121a24",
    surfaceAlt: "#18222e",
    border: "#243040",
    gridLine: "#1c2734",
    axisLine: "#33465c",

    textPrimary: "#e6edf5",
    textSecondary: "#9fb0c3",
    textMuted: "#63758a",

    series: [
      "#4dabf7",
      "#38d9a9",
      "#ffd43b",
      "#ff8787",
      "#b197fc",
      "#63e6be",
      "#ffa94d",
      "#74c0fc",
    ],

    status: {
      normal: "#38d9a9",
      warning: "#ffd43b",
      critical: "#ff6b6b",
      idle: "#748ffc",
      offline: "#5c6b7a",
      maintenance: "#e599f7",
    },

    accent: "#4dabf7",
    thresholdWarning: "rgba(255, 212, 59, 0.16)",
    thresholdCritical: "rgba(255, 107, 107, 0.18)",
    predictionBand: "rgba(77, 171, 247, 0.14)",

    tooltipBackground: "rgba(18, 26, 36, 0.96)",
    tooltipBorder: "#33465c",
  },
};

export const industrialLight: VizTheme = {
  name: "industrial-light",
  dark: false,
  radius: 8,
  font: { ...font },
  motion: {
    pulseDuration: 1600,
    chartAnimationDuration: 240,
  },
  palette: {
    background: "#f4f6f9",
    surface: "#ffffff",
    surfaceAlt: "#eef1f6",
    border: "#dde3ec",
    gridLine: "#e8ecf2",
    axisLine: "#c2cbd8",

    textPrimary: "#1b2836",
    textSecondary: "#51637a",
    textMuted: "#8494a8",

    series: [
      "#1c7ed6",
      "#0ca678",
      "#f08c00",
      "#e03131",
      "#7048e8",
      "#0b7285",
      "#d6336c",
      "#5c7cfa",
    ],

    status: {
      normal: "#0ca678",
      warning: "#f08c00",
      critical: "#e03131",
      idle: "#4c6ef5",
      offline: "#adb5bd",
      maintenance: "#9c36b5",
    },

    accent: "#1c7ed6",
    thresholdWarning: "rgba(240, 140, 0, 0.14)",
    thresholdCritical: "rgba(224, 49, 49, 0.14)",
    predictionBand: "rgba(28, 126, 214, 0.12)",

    tooltipBackground: "rgba(255, 255, 255, 0.98)",
    tooltipBorder: "#dde3ec",
  },
};

// `status` is merged key by key rather than replaced, so an override naming one status
// does not wipe the other five.
export function createTheme(
  base: VizTheme,
  override: VizThemeOverride,
): VizTheme {
  return {
    ...base,
    ...(override.dark === undefined ? {} : { dark: override.dark }),
    ...(override.radius === undefined ? {} : { radius: override.radius }),
    name: override.name,
    font: { ...base.font, ...override.font },
    motion: { ...base.motion, ...override.motion },
    palette: {
      ...base.palette,
      ...override.palette,
      status: { ...base.palette.status, ...override.palette?.status },
    },
  };
}
