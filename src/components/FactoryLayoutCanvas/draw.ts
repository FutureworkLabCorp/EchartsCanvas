import type { VizTheme } from "../../theme/types";
import type {
  ConveyorPath,
  EquipmentNode,
  FactoryLayout,
  LayoutZone,
} from "../../types/domain";

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: FactoryLayout,
  theme: VizTheme,
): void {
  const size = layout.gridSize ?? 0;
  if (size <= 0) return;

  ctx.save();
  ctx.strokeStyle = theme.palette.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= layout.width; x += size) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, layout.height);
  }
  for (let y = 0; y <= layout.height; y += size) {
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = theme.palette.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, layout.width, layout.height);
  ctx.restore();
}

export function drawZone(
  ctx: CanvasRenderingContext2D,
  zone: LayoutZone,
  theme: VizTheme,
): void {
  ctx.save();
  ctx.fillStyle = zone.color ?? theme.palette.surfaceAlt;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = theme.palette.border;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
  ctx.setLineDash([]);

  ctx.fillStyle = theme.palette.textMuted;
  ctx.font = `600 12px ${theme.font.family}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(zone.name, zone.x + 8, zone.y + 8);
  ctx.restore();
}

export function drawConveyor(
  ctx: CanvasRenderingContext2D,
  conveyor: ConveyorPath,
  theme: VizTheme,
  elapsed: number,
): void {
  const points = conveyor.points;
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const [first, ...rest] = points;
  if (!first) {
    ctx.restore();
    return;
  }
  ctx.moveTo(first.x, first.y);
  for (const point of rest) ctx.lineTo(point.x, point.y);

  ctx.strokeStyle = theme.palette.surfaceAlt;
  ctx.lineWidth = 10;
  ctx.stroke();

  const direction = conveyor.direction ?? 1;
  ctx.strokeStyle = theme.palette.accent;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  // Marching the dash offset reads as flow without recomputing any geometry.
  ctx.lineDashOffset = direction === 0 ? 0 : -((elapsed / 24) * direction) % 22;
  ctx.stroke();
  ctx.restore();
}

export interface EquipmentDrawState {
  hovered: boolean;
  selected: boolean;
  // 0..1
  pulse: number;
}

export function drawEquipment(
  ctx: CanvasRenderingContext2D,
  node: EquipmentNode,
  theme: VizTheme,
  state: EquipmentDrawState,
  showLabel: boolean,
): void {
  const color =
    theme.palette.status[node.status] ?? theme.palette.status.offline;
  const { x, y, width, height } = node;
  const radius = Math.min(6, width / 4, height / 4);

  ctx.save();
  if (node.rotation) {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((node.rotation * Math.PI) / 180);
    ctx.translate(-(x + width / 2), -(y + height / 2));
  }

  // Only abnormal states pulse. Animating every machine would mean a full repaint each
  // frame on a plan where almost nothing is wrong.
  if (node.status === "warning" || node.status === "critical") {
    const spread = 4 + state.pulse * 12;
    ctx.globalAlpha = (1 - state.pulse) * 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    roundRectPath(
      ctx,
      x - spread,
      y - spread,
      width + spread * 2,
      height + spread * 2,
      radius + spread,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = theme.dark ? `${color}33` : `${color}22`;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = state.selected ? 3 : state.hovered ? 2 : 1.2;
  ctx.stroke();

  if (state.selected) {
    ctx.save();
    ctx.strokeStyle = theme.palette.textPrimary;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    roundRectPath(ctx, x - 5, y - 5, width + 10, height + 10, radius + 4);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(x + width - 8, y + 8, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  if (showLabel) {
    ctx.fillStyle = theme.palette.textPrimary;
    ctx.font = `600 11px ${theme.font.family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.name, x + width / 2, y + height / 2, width - 8);
  }

  ctx.restore();
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
