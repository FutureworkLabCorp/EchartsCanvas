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

// The header and body heights are fixed so a chart inside never sees its container
// resize as its own content changes, which would feed back into another resize.
export const Panel = ({
  title,
  subtitle,
  extra,
  children,
  height = 320,
  className,
  style,
  bodyStyle,
}: PanelProps) => {
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
};

export interface StatusBadgeProps {
  status: StatusKey;
  // Required: a badge with only a coloured dot says nothing, and the library holds no
  // copy of its own to fall back to.
  label: string;
}

export const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const theme = useVizTheme();
  const color = theme.palette.status[status];
  return (
    <span className="viz-badge" style={{ color, background: `${color}1f` }}>
      <span className="viz-badge__dot" />
      {label}
    </span>
  );
};
