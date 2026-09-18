import type { SimNode } from "../../core/force";
import type {
  GraphNode,
  GraphTypeIcon,
  GraphTypeStyle,
} from "../../types/domain";
import type { VizTheme } from "../../theme/types";

export interface RenderNode extends SimNode {
  node: GraphNode;
  width: number;
  height: number;
}

export const FONT_TYPE = 11;
export const FONT_LABEL = 13;
const PAD_X = 12;
const PAD_Y = 9;
const ICON = 12;
const ICON_GAP = 5;
const LINE_GAP = 5;
const MAX_LABEL_WIDTH = 190;
const CARD_RADIUS = 8;

// One width estimate for the whole component. Canvas measureText would be exact, but the
// layout forces run without a context and must agree with what is drawn, so both go
// through this. CJK glyphs are full-width, latin roughly half.
export const measureLabel = (text: string, fontSize: number): number => {
  let units = 0;
  for (const char of text) {
    units += (char.codePointAt(0) ?? 0) > 0x2e80 ? 1 : 0.55;
  }
  return units * fontSize;
};

export const nodeSize = (
  node: GraphNode,
  typeLabel: string,
): { width: number; height: number } => {
  const typeRow = ICON + ICON_GAP + measureLabel(typeLabel, FONT_TYPE);
  const labelRow = Math.min(
    measureLabel(node.label, FONT_LABEL),
    MAX_LABEL_WIDTH,
  );
  return {
    width: Math.max(typeRow, labelRow) + PAD_X * 2,
    height: PAD_Y * 2 + FONT_TYPE + LINE_GAP + FONT_LABEL,
  };
};

// The collision radius has to cover the card's corner, not its half-width, or cards
// overlap along the diagonal.
export const collisionRadius = (node: RenderNode): number =>
  Math.hypot(node.width, node.height) / 2 + 6;

export type LabelMode = "dot" | "pill" | "card";

// Below these scales a card is unreadable anyway, so it degrades to a pill and then to a
// dot. That is also what keeps a zoomed-out graph from drawing hundreds of text runs.
export const pickLabelMode = (scale: number): LabelMode => {
  if (scale < 0.35) return "dot";
  if (scale < 0.7) return "pill";
  return "card";
};

const truncate = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text.length;
  while (
    cut > 1 &&
    ctx.measureText(`${text.slice(0, cut)}…`).width > maxWidth
  ) {
    cut -= 1;
  }
  return `${text.slice(0, cut)}…`;
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// A small filled glyph per type. Deliberately geometric rather than an icon font: a font
// is a network or bundle dependency, and these read at 12px.
const drawTypeIcon = (
  ctx: CanvasRenderingContext2D,
  icon: GraphTypeIcon,
  x: number,
  y: number,
  color: string,
): void => {
  const s = ICON;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;

  switch (icon) {
    case "alert": {
      ctx.beginPath();
      ctx.moveTo(x + s / 2, y + 1);
      ctx.lineTo(x + s - 1, y + s - 1);
      ctx.lineTo(x + 1, y + s - 1);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(x + s / 2 - 0.7, y + 4, 1.4, 4);
      ctx.fillRect(x + s / 2 - 0.7, y + s - 3.4, 1.4, 1.4);
      break;
    }
    case "gear": {
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s / 2 - 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "flow": {
      ctx.beginPath();
      ctx.arc(x + s / 2, y + 2.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 2.5, y + s - 2.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + s - 2.5, y + s - 2.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + s / 2, y + 4.5);
      ctx.lineTo(x + s / 2, y + s / 2);
      ctx.moveTo(x + 2.5, y + s - 4.5);
      ctx.lineTo(x + 2.5, y + s / 2);
      ctx.lineTo(x + s - 2.5, y + s / 2);
      ctx.lineTo(x + s - 2.5, y + s - 4.5);
      ctx.stroke();
      break;
    }
    case "layers": {
      ctx.beginPath();
      ctx.moveTo(x + s / 2, y + 1.5);
      ctx.lineTo(x + s - 1, y + 4.5);
      ctx.lineTo(x + s / 2, y + 7.5);
      ctx.lineTo(x + 1, y + 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 1, y + s - 3.5);
      ctx.lineTo(x + s / 2, y + s - 0.5);
      ctx.lineTo(x + s - 1, y + s - 3.5);
      ctx.stroke();
      break;
    }
    case "person": {
      ctx.beginPath();
      ctx.arc(x + s / 2, y + 4, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s + 1, 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.fill();
      break;
    }
    default: {
      roundedRect(ctx, x + 1, y + 1, s - 2, s - 2, 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(x + 3.5, y + 4.5);
      ctx.lineTo(x + s - 3.5, y + 4.5);
      ctx.moveTo(x + 3.5, y + 7.5);
      ctx.lineTo(x + s - 4.5, y + 7.5);
      ctx.stroke();
    }
  }
};

export interface DrawNodeOptions {
  theme: VizTheme;
  style: GraphTypeStyle;
  mode: LabelMode;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
}

export const drawNode = (
  ctx: CanvasRenderingContext2D,
  node: RenderNode,
  { theme, style, mode, selected, hovered, dimmed }: DrawNodeOptions,
): void => {
  const { palette } = theme;

  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.25;

  if (mode === "dot") {
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, selected || hovered ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (mode === "pill") {
    ctx.font = `500 ${FONT_LABEL}px ${theme.font.family}`;
    const text = truncate(ctx, node.node.label, MAX_LABEL_WIDTH);
    const w = ctx.measureText(text).width + 22;
    const h = 22;
    roundedRect(ctx, node.x - w / 2, node.y - h / 2, w, h, h / 2);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = selected ? style.color : palette.border;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(node.x - w / 2 + 11, node.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.textPrimary;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, node.x - w / 2 + 19, node.y + 0.5);
    ctx.restore();
    return;
  }

  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;

  // The shadow goes on the card only; resetting it before the text keeps the glyphs crisp.
  ctx.shadowColor = theme.dark ? "rgba(0,0,0,0.5)" : "rgba(15,23,42,0.10)";
  ctx.shadowBlur = hovered || selected ? 12 : 5;
  ctx.shadowOffsetY = 1.5;
  roundedRect(ctx, x, y, node.width, node.height, CARD_RADIUS);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = selected ? style.color : palette.border;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.stroke();

  drawTypeIcon(ctx, style.icon ?? "doc", x + PAD_X, y + PAD_Y, style.color);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 ${FONT_TYPE}px ${theme.font.family}`;
  ctx.fillStyle = style.color;
  ctx.fillText(style.label, x + PAD_X + ICON + ICON_GAP, y + PAD_Y + 0.5);

  ctx.font = `500 ${FONT_LABEL}px ${theme.font.family}`;
  ctx.fillStyle = palette.textPrimary;
  ctx.fillText(
    truncate(ctx, node.node.label, MAX_LABEL_WIDTH),
    x + PAD_X,
    y + PAD_Y + FONT_TYPE + LINE_GAP,
  );

  ctx.restore();
};

// Every edge bows by the same fraction of its own length, which separates the two edges
// of a reciprocal pair and keeps long edges from cutting straight through the middle.
export const edgeControlPoint = (
  a: RenderNode,
  b: RenderNode,
  curvature: number,
): { cx: number; cy: number } => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { cx: mx + dy * curvature, cy: my - dx * curvature };
};

export const drawEdge = (
  ctx: CanvasRenderingContext2D,
  a: RenderNode,
  b: RenderNode,
  color: string,
  width: number,
  curvature: number,
): void => {
  const { cx, cy } = edgeControlPoint(a, b, curvature);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cx, cy, b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
};

export const hitNode = (
  node: RenderNode,
  px: number,
  py: number,
  mode: LabelMode,
): boolean => {
  if (mode === "dot") return Math.hypot(node.x - px, node.y - py) <= 8;
  const w = mode === "pill" ? node.width : node.width;
  const h = mode === "pill" ? 22 : node.height;
  return (
    px >= node.x - w / 2 &&
    px <= node.x + w / 2 &&
    py >= node.y - h / 2 &&
    py <= node.y + h / 2
  );
};
