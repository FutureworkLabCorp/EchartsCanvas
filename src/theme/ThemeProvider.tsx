import { createContext, useContext, useEffect, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { registerVizTheme } from "./echartsTheme";
import { industrialDark } from "./presets";
import type { StatusKey, VizTheme } from "./types";

interface ThemeContextValue {
  theme: VizTheme;
  /** ECharts init 에 넘길 등록된 테마 이름 */
  echartsThemeName: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  theme?: VizTheme;
  children: ReactNode;
  /**
   * true 이면 자식 요소를 감싸는 div 에 CSS 변수(--viz-*)를 주입한다.
   * 차트 외 UI(카드, 범례 등)에서 동일 토큰을 쓰기 위한 장치.
   */
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
  // 테마 객체가 바뀔 때마다 ECharts 레지스트리에 (재)등록한다.
  useEffect(() => {
    registerVizTheme(theme);
  }, [theme]);

  // 최초 렌더에서 BaseChart 가 init 하기 전에 등록이 끝나야 하므로 동기 등록도 수행.
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

/** Provider 가 없으면 기본 다크 테마로 폴백한다(단독 사용 가능). */
export function useVizTheme(): VizTheme {
  return useContext(ThemeContext)?.theme ?? industrialDark;
}

export function useEChartsThemeName(): string {
  return useContext(ThemeContext)?.echartsThemeName ?? industrialDark.name;
}

/** 상태 코드 → 색상. 미정의 상태는 offline 색으로 폴백. */
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
