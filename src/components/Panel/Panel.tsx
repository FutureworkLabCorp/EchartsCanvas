import type { CSSProperties, ReactNode } from "react";
import { useVizTheme } from "../../theme/ThemeProvider";
import type { StatusKey } from "../../theme/types";

export interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

/** 차트를 감싸는 공통 카드 레이아웃. 헤더/본문 영역 높이를 고정해 차트 resize 를 안정화한다. */
export function Panel({
  title,
  subtitle,
  extra,
  children,
  height = 320,
  className,
  style,
  bodyStyle,
}: PanelProps) {
  return (
    <div
      className={["viz-panel", className].filter(Boolean).join(" ")}
      style={{ height, ...style }}
    >
      {(title || extra) && (
        <div className="viz-panel__header">
          <div>
            <div className="viz-panel__title">{title}</div>
            {subtitle && <div className="viz-panel__subtitle">{subtitle}</div>}
          </div>
          {extra}
        </div>
      )}
      <div className="viz-panel__body" style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}

export interface StatusBadgeProps {
  status: StatusKey;
  label?: string;
}

const STATUS_LABEL: Record<StatusKey, string> = {
  normal: "정상",
  warning: "주의",
  critical: "경고",
  idle: "대기",
  offline: "오프라인",
  maintenance: "점검중",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const theme = useVizTheme();
  const color = theme.palette.status[status];
  return (
    <span className="viz-badge" style={{ color, background: `${color}1f` }}>
      <span className="viz-badge__dot" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
