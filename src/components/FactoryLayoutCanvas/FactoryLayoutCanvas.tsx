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
  /** 실시간 상태 오버레이. layout.equipments 의 status 를 덮어쓴다. */
  statusOverrides?: Record<string, EquipmentStatus>;
  selectedId?: string | null;
  showLabels?: boolean;
  showTooltip?: boolean;
  /** 컨테이너 크기에 맞춰 도면을 자동 맞춤(기본 true) */
  autoFit?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
  /** 정적 도면이면 false 로 두어 rAF 루프를 끄고 필요할 때만 렌더한다. */
  animate?: boolean;
  onSelect?: (equipment: EquipmentNode | null) => void;
  onHover?: (equipment: EquipmentNode | null) => void;
  /** true 면 선택/호버를 EventBus 로도 발행한다(기본 true) */
  emitEvents?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * 2D 공장 레이아웃 / 스마트 맵.
 *
 * `Canvas2DBase` 를 확장해 도면 배경·존·컨베이어·설비를 직접 렌더한다.
 * SVG/DOM 노드 대신 Canvas 한 장에 그리므로 설비 수백 대에서도 노드 폭증이 없다.
 * 클릭·호버는 DOM 이벤트가 아니라 좌표 기반 Hit Detection 으로 판정한다.
 */
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
  /** draw 콜백이 최신 hover 대상을 읽되, 리렌더로 재생성되지 않도록 ref 로 보관한다. */
  const tooltipRef = useRef<EquipmentNode | null>(null);
  const [tooltip, setTooltip] = useState<{
    node: EquipmentNode;
    x: number;
    y: number;
  } | null>(null);

  // 상태 오버레이를 적용한 최종 설비 목록
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

  // 배경 평면도 로딩
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

  // 도면이 바뀌면 다시 맞춘다.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    fit({ width: rect.width, height: rect.height });
  }, [fit]);

  const draw = useCallback(
    ({ ctx, frame, theme: current }: Canvas2DDrawArgs) => {
      // 배경 평면도
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

      // 0→1 을 반복하는 펄스 위상
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
