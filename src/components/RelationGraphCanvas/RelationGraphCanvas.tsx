import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Canvas2DBase } from "../../core/Canvas2DBase/Canvas2DBase";
import type {
  Canvas2DDrawArgs,
  Canvas2DHandle,
  Point,
  Viewport,
} from "../../core/Canvas2DBase/types";
import { pickTopMost } from "../../core/Canvas2DBase/hit";
import {
  ForceSimulation,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forcePosition,
} from "../../core/force";
import type { SimLink } from "../../core/force";
import { useVizTheme } from "../../theme/ThemeProvider";
import type { GraphData, GraphNode, GraphTypeStyle } from "../../types/domain";
import {
  collisionRadius,
  drawEdge,
  drawNode,
  hitNode,
  nodeSize,
  pickLabelMode,
} from "./draw";
import type { RenderNode } from "./draw";

export interface RelationGraphCanvasProps {
  data: GraphData;
  // Keyed by GraphNode.type. A type with no entry falls back to the neutral style below.
  typeStyles: Record<string, GraphTypeStyle>;
  selectedId?: string | null;
  // Dims everything not touching the selection, which is what makes one node's
  // neighbourhood readable in a graph this dense.
  focusNeighbours?: boolean;
  linkDistance?: number;
  chargeStrength?: number;
  // How hard unlinked nodes are held towards the middle. Lower spreads the graph out.
  gravity?: number;
  // The first view never zooms out past this. Fitting several hundred cards onto one
  // screen lands the scale around 0.14, well under the threshold where cards degrade to
  // dots, so the graph opens at full size and pans instead of opening unreadable.
  minInitialScale?: number;
  onSelect?: (node: GraphNode | null) => void;
  onHover?: (node: GraphNode | null) => void;
  // Unset renders no aria-label rather than a fabricated one.
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

const FALLBACK_STYLE: GraphTypeStyle = { label: "", color: "#94a3b8" };
const EDGE_CURVATURE = 0.12;

// Runs the layout to rest before the first paint, synchronously. Measured on 2026-09-18:
// 156ms at 100 nodes, 848ms at 439, 2.1s at 1000, 8s at 4000 — all of it blocking the
// main thread, so the page is frozen for that whole time. The alternative, ticking the
// simulation inside the render loop, trades that freeze for a visible scramble; neither
// is right yet and the choice is still open.
const layout = (
  data: GraphData,
  typeStyles: Record<string, GraphTypeStyle>,
  linkDistance: number,
  chargeStrength: number,
  gravity: number,
): {
  nodes: RenderNode[];
  edges: Array<{ a: RenderNode; b: RenderNode; weight: number }>;
} => {
  const nodes: RenderNode[] = data.nodes.map((node) => {
    const size = nodeSize(
      node,
      (typeStyles[node.type] ?? FALLBACK_STYLE).label,
    );
    return {
      id: node.id,
      node,
      x: NaN,
      y: NaN,
      vx: 0,
      vy: 0,
      width: size.width,
      height: size.height,
    };
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links: Array<SimLink<RenderNode>> = [];
  const edges: Array<{ a: RenderNode; b: RenderNode; weight: number }> = [];
  for (const edge of data.edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    // An edge naming a node the payload did not include is dropped rather than faked.
    if (!a || !b || a === b) continue;
    links.push({ source: a, target: b });
    edges.push({ a, b, weight: edge.weight ?? 0.5 });
  }

  new ForceSimulation(nodes)
    .addForce("link", forceLink(links, { distance: linkDistance }))
    .addForce("charge", forceManyBody({ strength: chargeStrength }))
    .addForce(
      "collide",
      forceCollide({ radius: collisionRadius, iterations: 2 }),
    )
    .addForce("position", forcePosition({ strength: gravity }))
    .addForce("center", forceCenter(0, 0))
    .settle();

  return { nodes, edges };
};

export const RelationGraphCanvas = ({
  data,
  typeStyles,
  selectedId = null,
  focusNeighbours = true,
  linkDistance = 130,
  chargeStrength = -700,
  gravity = 0.1,
  minInitialScale = 1,
  onSelect,
  onHover,
  ariaLabel,
  className,
  style,
}: RelationGraphCanvasProps) => {
  const theme = useVizTheme();
  const canvasRef = useRef<Canvas2DHandle>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const scaleRef = useRef(1);

  const { nodes, edges } = useMemo(
    () => layout(data, typeStyles, linkDistance, chargeStrength, gravity),
    [data, typeStyles, linkDistance, chargeStrength, gravity],
  );

  // Ids one hop from the selection, so the draw pass can dim the rest without walking
  // the edge list per node.
  const neighbours = useMemo(() => {
    if (!selectedId || !focusNeighbours) return null;
    const ids = new Set<string>([selectedId]);
    for (const edge of data.edges) {
      if (edge.source === selectedId) ids.add(edge.target);
      else if (edge.target === selectedId) ids.add(edge.source);
    }
    return ids;
  }, [selectedId, focusNeighbours, data.edges]);

  const fit = useCallback(
    (size: { width: number; height: number }) => {
      if (nodes.length === 0 || size.width === 0 || size.height === 0) return;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const node of nodes) {
        x0 = Math.min(x0, node.x - node.width / 2);
        y0 = Math.min(y0, node.y - node.height / 2);
        x1 = Math.max(x1, node.x + node.width / 2);
        y1 = Math.max(y1, node.y + node.height / 2);
      }
      const padding = 48;
      const scale = Math.max(
        minInitialScale,
        Math.min(
          (size.width - padding * 2) / Math.max(1, x1 - x0),
          (size.height - padding * 2) / Math.max(1, y1 - y0),
          1,
        ),
      );
      canvasRef.current?.setViewport({
        scale,
        offsetX: size.width / 2 - ((x0 + x1) / 2) * scale,
        offsetY: size.height / 2 - ((y0 + y1) / 2) * scale,
      });
    },
    [nodes, minInitialScale],
  );

  const draw = useCallback(
    ({ ctx, viewport }: Canvas2DDrawArgs) => {
      scaleRef.current = viewport.scale;
      const mode = pickLabelMode(viewport.scale);

      // Edges first, as one pass, so every card paints over them.
      for (const { a, b, weight } of edges) {
        // An edge stays lit only when both of its ends are in the focus set, which for a
        // selection means the edges radiating from it.
        const dimmed = neighbours
          ? !(neighbours.has(a.id) && neighbours.has(b.id))
          : false;
        ctx.globalAlpha = dimmed ? 0.18 : 1;
        drawEdge(
          ctx,
          a,
          b,
          theme.palette.gridLine,
          0.6 + weight * 1.2,
          EDGE_CURVATURE,
        );
      }
      ctx.globalAlpha = 1;

      for (const node of nodes) {
        drawNode(ctx, node, {
          theme,
          style: typeStyles[node.node.type] ?? FALLBACK_STYLE,
          mode,
          selected: node.id === selectedId,
          hovered: hovered?.id === node.id,
          dimmed: neighbours ? !neighbours.has(node.id) : false,
        });
      }
    },
    [edges, nodes, theme, typeStyles, selectedId, hovered, neighbours],
  );

  const hitTest = useCallback(
    (point: Point): GraphNode | null => {
      const mode = pickLabelMode(scaleRef.current);
      const found = pickTopMost(nodes, (node) =>
        hitNode(node, point.x, point.y, mode),
      );
      return found?.node ?? null;
    },
    [nodes],
  );

  const handleHover = useCallback(
    (node: GraphNode | null) => {
      setHovered(node);
      onHover?.(node);
      canvasRef.current?.requestRedraw();
    },
    [onHover],
  );

  const handleViewportChange = useCallback((viewport: Viewport) => {
    // A zoom can cross a label-mode threshold, which changes the hit areas too.
    scaleRef.current = viewport.scale;
  }, []);

  return (
    <Canvas2DBase<GraphNode>
      ref={canvasRef}
      onDraw={draw}
      hitTest={hitTest}
      onItemClick={(node) => onSelect?.(node)}
      onItemHover={handleHover}
      onBackgroundClick={() => onSelect?.(null)}
      onViewportChange={handleViewportChange}
      onResize={fit}
      // The layout is already at rest, so there is nothing to animate; frames are drawn
      // on demand when the selection, hover or viewport changes.
      renderMode="on-demand"
      interaction={{ pan: true, zoom: true, minScale: 0.1, maxScale: 2.5 }}
      backgroundColor={theme.palette.background}
      ariaLabel={ariaLabel}
      className={className}
      style={style}
    />
  );
};
