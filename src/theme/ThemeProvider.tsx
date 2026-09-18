import { createContext, useContext, useEffect, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { registerVizTheme } from "./echartsTheme";
import { industrialDark } from "./presets";
import type { StatusKey, VizTheme } from "./types";

interface ThemeContextValue {
  theme: VizTheme;
  echartsThemeName: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  theme?: VizTheme;
  children: ReactNode;
  // Publishes the palette as --viz-* custom properties on the wrapper, so non-chart
  // UI around the charts can reach the same values from CSS.
  injectCssVariables?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ThemeProvider({
  theme = industrialDark,
  children,
  injectCssVariables = true,
  className,
  style,
}: ThemeProviderProps) {
  useEffect(() => {
    registerVizTheme(theme);
  }, [theme]);

  // Also registered during render: a child BaseChart calls echarts.init in its own
  // layout effect, which runs before this component's effect.
  useMemo(() => registerVizTheme(theme), [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, echartsThemeName: theme.name }),
    [theme],
  );

  const cssVars = useMemo(
    () => (injectCssVariables ? toCssVariables(theme) : undefined),
    [theme, injectCssVariables],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={className}
        data-viz-theme={theme.name}
        data-viz-scheme={theme.dark ? "dark" : "light"}
        style={{ ...cssVars, ...style }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// Falls back to the dark preset so a component works without a Provider above it.
export function useVizTheme(): VizTheme {
  return useContext(ThemeContext)?.theme ?? industrialDark;
}

export function useEChartsThemeName(): string {
  return useContext(ThemeContext)?.echartsThemeName ?? industrialDark.name;
}

// An unknown status reads as offline rather than throwing or rendering colourless.
export function useStatusColor(): (status: StatusKey | string) => string {
  const theme = useVizTheme();
  return (status) =>
    theme.palette.status[status as StatusKey] ?? theme.palette.status.offline;
}

function toCssVariables(theme: VizTheme): CSSProperties {
  const { palette, font, radius } = theme;
  const vars: Record<string, string> = {
    "--viz-bg": palette.background,
    "--viz-surface": palette.surface,
    "--viz-surface-alt": palette.surfaceAlt,
    "--viz-border": palette.border,
    "--viz-grid-line": palette.gridLine,
    "--viz-text-primary": palette.textPrimary,
    "--viz-text-secondary": palette.textSecondary,
    "--viz-text-muted": palette.textMuted,
    "--viz-accent": palette.accent,
    "--viz-radius": `${radius}px`,
    "--viz-font": font.family,
    "--viz-font-mono": font.monoFamily,
  };
  for (const [key, color] of Object.entries(palette.status)) {
    vars[`--viz-status-${key}`] = color;
  }
  palette.series.forEach((color, i) => {
    vars[`--viz-series-${i}`] = color;
  });
  return vars as CSSProperties;
}
