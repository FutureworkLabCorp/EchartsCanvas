import { useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { Canvas2DBase } from "../../core/Canvas2DBase/Canvas2DBase";
import type { Canvas2DDrawArgs } from "../../core/Canvas2DBase/types";
import { clamp } from "../../core/utils/format";

export interface LiquidFillWidgetProps {
  /** 0~1 */
  value: number;
  label?: string;
  /** 미지정 시 임계값에 따라 테마 상태색 사용 */
  color?: string;
  warningBelow?: number;
  criticalBelow?: number;
  /** 값 변화 시 물결 높이가 부드럽게 따라가는 속도(0~1, 프레임당 보간 계수) */
  easing?: number;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * LiquidFill(수위) 위젯.
 *
 * ECharts 플러그인(echarts-liquidfill) 대신 `Canvas2DBase` 위에 직접 구현했다.
 * - 플러그인은 전체 echarts 번들에 의존해 코어 트리셰이킹을 깨뜨린다.
 * - 파형 애니메이션은 도형 1개짜리 단순 렌더라 공통 Canvas 루프로 충분하다.
 */
export function LiquidFillWidget({
  value,
  label,
  color,
  warningBelow = 0.75,
  criticalBelow = 0.6,
  easing = 0.08,
  paused = false,
  className,
  style,
}: LiquidFillWidgetProps) {
  const displayRef = useRef(clamp(value, 0, 1));
  const targetRef = useRef(clamp(value, 0, 1));
  targetRef.current = clamp(value, 0, 1);

  const draw = useCallback(
    ({ ctx, width, height, frame, theme }: Canvas2DDrawArgs) => {
      // 현재 표시값을 목표값으로 서서히 보간해 급격한 값 점프를 완화한다.
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

      // 외곽 링
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 원 내부로 클리핑 후 물결 채우기
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

      // 라벨
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
      ariaLabel={`${label ?? "수위"} 위젯`}
    />
  );
}
