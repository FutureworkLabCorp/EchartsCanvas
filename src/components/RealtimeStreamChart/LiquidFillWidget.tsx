import { useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { Canvas2DBase } from "../../core/Canvas2DBase/Canvas2DBase";
import type { Canvas2DDrawArgs } from "../../core/Canvas2DBase/types";
import { clamp } from "../../core/utils/format";

export interface LiquidFillWidgetProps {
  // 0..1
  value: number;
  label?: string;
  // Falls back to the theme status colour for the band the value lands in.
  color?: string;
  warningBelow?: number;
  criticalBelow?: number;
  // Per-frame interpolation factor in 0..1, not a duration.
  easing?: number;
  paused?: boolean;
  // Unset renders no aria-label rather than a fabricated one.
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

// Built on Canvas2DBase rather than echarts-liquidfill: that plugin pulls the full
// ECharts bundle and breaks the modular registration in core/echarts. The wave is one
// shape, so the shared canvas loop covers it.
export const LiquidFillWidget = ({
  value,
  label,
  color,
  warningBelow = 0.75,
  criticalBelow = 0.6,
  easing = 0.08,
  paused = false,
  ariaLabel,
  className,
  style,
}: LiquidFillWidgetProps) => {
  const displayRef = useRef(clamp(value, 0, 1));
  const targetRef = useRef(clamp(value, 0, 1));
  targetRef.current = clamp(value, 0, 1);

  const draw = useCallback(
    ({ ctx, width, height, frame, theme }: Canvas2DDrawArgs) => {
      // Interpolating towards the target: a sensor step change would otherwise snap.
      displayRef.current += (targetRef.current - displayRef.current) * easing;
      const ratio = displayRef.current;

      const { palette, font } = theme;
      const fill =
        color ??
        (ratio < criticalBelow
          ? palette.status.critical
          : ratio < warningBelow
            ? palette.status.warning
            : palette.status.normal);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2 - 6;
      if (radius <= 0) return;

      ctx.save();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
      ctx.clip();

      const level = cy + radius - ratio * radius * 2;
      const phase = (frame.elapsed / 1000) * 1.6;
      const amplitude = radius * 0.06;

      const drawWave = (offset: number, alpha: number) => {
        ctx.beginPath();
        ctx.moveTo(cx - radius, height);
        for (let x = cx - radius; x <= cx + radius; x += 3) {
          const t = (x - cx) / radius;
          const y =
            level + Math.sin(t * Math.PI * 2 + phase + offset) * amplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(cx + radius, height);
        ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.fill();
      };

      drawWave(0, 0.35);
      drawWave(Math.PI * 0.8, 0.7);
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = palette.textPrimary;
      ctx.font = `600 ${Math.round(radius * 0.42)}px ${font.monoFamily}`;
      ctx.fillText(
        `${Math.round(ratio * 100)}%`,
        cx,
        cy - (label ? radius * 0.12 : 0),
      );
      if (label) {
        ctx.fillStyle = palette.textSecondary;
        ctx.font = `${Math.round(radius * 0.18)}px ${font.family}`;
        ctx.fillText(label, cx, cy + radius * 0.32);
      }
      ctx.restore();
    },
    [color, criticalBelow, easing, label, warningBelow],
  );

  return (
    <Canvas2DBase
      onDraw={draw}
      renderMode="loop"
      paused={paused}
      maxFps={30}
      backgroundColor="transparent"
      className={className}
      style={style}
      ariaLabel={ariaLabel}
    />
  );
};
