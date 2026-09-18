import type { Point } from "./types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export function hitRect(p: Point, rect: Rect, padding = 0): boolean {
  return (
    p.x >= rect.x - padding &&
    p.x <= rect.x + rect.width + padding &&
    p.y >= rect.y - padding &&
    p.y <= rect.y + rect.height + padding
  );
}

export function hitCircle(p: Point, circle: Circle, padding = 0): boolean {
  const r = circle.radius + padding;
  const dx = p.x - circle.x;
  const dy = p.y - circle.y;
  return dx * dx + dy * dy <= r * r;
}

export function hitPolygon(p: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Walks backwards so the last-drawn object, the one visually on top, wins an overlap.
export function pickTopMost<T>(
  items: readonly T[],
  test: (item: T) => boolean,
): T | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item !== undefined && test(item)) return item;
  }
  return null;
}

export function fitToViewport(
  content: { width: number; height: number },
  container: { width: number; height: number },
  padding = 24,
): { scale: number; offsetX: number; offsetY: number } {
  if (
    content.width <= 0 ||
    content.height <= 0 ||
    container.width <= 0 ||
    container.height <= 0
  ) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(
    (container.width - padding * 2) / content.width,
    (container.height - padding * 2) / content.height,
  );
  const safeScale = scale > 0 ? scale : 1;
  return {
    scale: safeScale,
    offsetX: (container.width - content.width * safeScale) / 2,
    offsetY: (container.height - content.height * safeScale) / 2,
  };
}
