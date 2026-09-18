import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Canvas2DBase } from "../../core/Canvas2DBase/Canvas2DBase";
import type {
  Canvas2DDrawArgs,
  Canvas2DHandle,
  Point,
} from "../../core/Canvas2DBase/types";
import {
  fitToViewport,
  hitRect,
  pickTopMost,
} from "../../core/Canvas2DBase/hit";
import { vizEventBus } from "../../core/EventBus/EventBus";
import { VizEvent } from "../../core/EventBus/events";
import { useVizTheme } from "../../theme/ThemeProvider";
import type {
  EquipmentNode,
  EquipmentStatus,
  FactoryLayout,
} from "../../types/domain";
import { drawConveyor, drawEquipment, drawGrid, drawZone } from "./draw";

export interface FactoryLayoutCanvasProps {
  layout: FactoryLayout;
  // Overrides the status on layout.equipments, so the layout itself can stay static.
  statusOverrides?: Record<string, EquipmentStatus>;
  selectedId?: string | null;
  showLabels?: boolean;
  showTooltip?: boolean;
  autoFit?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
  // false stops the rAF loop, which is what a plan with no pulsing equipment wants.
  animate?: boolean;
  onSelect?: (equipment: EquipmentNode | null) => void;
  onHover?: (equipment: EquipmentNode | null) => void;
  emitEvents?: boolean;
  className?: string;
  style?: CSSProperties;
}

// Draws the plan, zones, conveyors and equipment onto one canvas rather than a DOM or
// SVG node per item, which is what keeps several hundred machines affordable. Clicks and
// hovers resolve by coordinate hit testing, since there are no elements to receive them.
export function FactoryLayoutCanvas({
  layout,
  statusOverrides,
  selectedId = null,
  showLabels = true,
  showTooltip = true,
  autoFit = true,
  enablePan = true,
  enableZoom = true,
  animate = true,
  onSelect,
  onHover,
  emitEvents = true,
  className,
  style,
}: FactoryLayoutCanvasProps) {
  const theme = useVizTheme();
  const canvasRef = useRef<Canvas2DHandle>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  // In a ref, not state: the draw callback has to read the current hover without being
  // rebuilt, and a re-render per hover would defeat the canvas.
  const tooltipRef = useRef<EquipmentNode | null>(null);
  const [tooltip, setTooltip] = useState<{
    node: EquipmentNode;
    x: number;
    y: number;
  } | null>(null);

  const equipments = useMemo<EquipmentNode[]>(
    () =>
      layout.equipments.map((node) =>
        statusOverrides?.[node.id]
          ? { ...node, status: statusOverrides[node.id] as EquipmentStatus }
          : node,
      ),
    [layout.equipments, statusOverrides],
  );
  const equipmentsRef = useRef(equipments);
  equipmentsRef.current = equipments;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!layout.backgroundImage) {
      backgroundRef.current = null;
      return;
    }
    const image = new Image();
    image.src = layout.backgroundImage;
    image.onload = () => {
      backgroundRef.current = image;
      canvasRef.current?.requestRedraw();
    };
    return () => {
      image.onload = null;
      backgroundRef.current = null;
    };
  }, [layout.backgroundImage]);

  const fit = useCallback(
    (size: { width: number; height: number }) => {
      if (!autoFit) return;
      canvasRef.current?.setViewport(fitToViewport(layout, size));
    },
    [autoFit, layout],
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    fit({ width: rect.width, height: rect.height });
  }, [fit]);

  const draw = useCallback(
    ({ ctx, frame, theme: current }: Canvas2DDrawArgs) => {
      const image = backgroundRef.current;
      if (image) {
        ctx.drawImage(image, 0, 0, layout.width, layout.height);
      } else {
        ctx.fillStyle = current.palette.surface;
        ctx.fillRect(0, 0, layout.width, layout.height);
      }

      drawGrid(ctx, layout, current);
      for (const zone of layout.zones ?? []) drawZone(ctx, zone, current);
      for (const conveyor of layout.conveyors ?? []) {
        drawConveyor(ctx, conveyor, current, frame.elapsed);
      }

      // Phase cycles 0 to 1; the draw helpers turn it into a radius and an alpha.
      const pulse =
        (frame.elapsed % current.motion.pulseDuration) /
        current.motion.pulseDuration;
      const hoveredId = tooltipRef.current?.id ?? null;

      for (const node of equipmentsRef.current) {
        drawEquipment(
          ctx,
          node,
          current,
          {
            hovered: node.id === hoveredId,
            selected: node.id === selectedRef.current,
            pulse,
          },
          showLabels,
        );
      }
    },
    [layout, showLabels],
  );

  const hitTest = useCallback(
    (point: Point) =>
      pickTopMost(equipmentsRef.current, (node) =>
        hitRect(
          point,
          { x: node.x, y: node.y, width: node.width, height: node.height },
          2,
        ),
      ),
    [],
  );

  const handleHover = useCallback(
    (node: EquipmentNode | null, event: PointerEvent) => {
      tooltipRef.current = node;
      onHover?.(node);
      if (emitEvents) {
        vizEventBus.emit(VizEvent.EQUIPMENT_HOVER, {
          equipment: node,
          source: "FactoryLayoutCanvas",
        });
      }

      if (!showTooltip) return;
      if (!node) {
        setTooltip(null);
        return;
      }
      const rect = wrapperRef.current?.getBoundingClientRect();
      setTooltip({
        node,
        x: event.clientX - (rect?.left ?? 0) + 12,
        y: event.clientY - (rect?.top ?? 0) + 12,
      });
    },
    [emitEvents, onHover, showTooltip],
  );

  const handleClick = useCallback(
    (node: EquipmentNode) => {
      onSelect?.(node);
      if (emitEvents) {
        vizEventBus.emit(VizEvent.EQUIPMENT_SELECT, {
          equipment: node,
          source: "FactoryLayoutCanvas",
        });
      }
    },
    [emitEvents, onSelect],
  );

  const handleBackgroundClick = useCallback(() => {
    onSelect?.(null);
    if (emitEvents) {
      vizEventBus.emit(VizEvent.EQUIPMENT_SELECT, {
        equipment: null,
        source: "FactoryLayoutCanvas",
      });
    }
  }, [emitEvents, onSelect]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      <Canvas2DBase<EquipmentNode>
        ref={canvasRef}
        onDraw={draw}
        hitTest={hitTest}
        onItemHover={handleHover}
        onItemClick={handleClick}
        onBackgroundClick={handleBackgroundClick}
        onResize={fit}
        renderMode={animate ? "loop" : "on-demand"}
        maxFps={30}
        interaction={{
          pan: enablePan,
          zoom: enableZoom,
          minScale: 0.3,
          maxScale: 6,
        }}
        backgroundColor={theme.palette.background}
        ariaLabel="공장 레이아웃 맵"
      />

      {showTooltip && tooltip && (
        <div
          className="viz-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <strong>{tooltip.node.name}</strong>
          <div style={{ color: theme.palette.status[tooltip.node.status] }}>
            {STATUS_TEXT[tooltip.node.status]}
          </div>
          {tooltip.node.metrics &&
            Object.entries(tooltip.node.metrics).map(([key, value]) => (
              <div key={key} style={{ color: theme.palette.textSecondary }}>
                {key}:{" "}
                <span style={{ color: theme.palette.textPrimary }}>
                  {value}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<EquipmentStatus, string> = {
  normal: "정상 가동",
  warning: "주의 — 지표 이탈",
  critical: "경고 — 즉시 확인",
  idle: "대기",
  offline: "오프라인",
  maintenance: "정비 중",
};
