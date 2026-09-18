import type { CSSProperties } from "react";
import type { FrameInfo } from "../../hooks/useAnimationLoop";
import type { VizTheme } from "../../theme/types";

export interface Point {
  x: number;
  y: number;
}

// World to screen: scale first, then offset.
export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Canvas2DDrawArgs {
  // Already carries the DPR scale and the viewport transform, so callbacks draw in world units.
  ctx: CanvasRenderingContext2D;
  // CSS pixels, not backing-store pixels.
  width: number;
  height: number;
  dpr: number;
  viewport: Viewport;
  frame: FrameInfo;
  theme: VizTheme;
  hovered: unknown;
}

export interface Canvas2DInteractionOptions {
  pan?: boolean;
  zoom?: boolean;
  minScale?: number;
  maxScale?: number;
  // Scale factor per wheel notch.
  zoomStep?: number;
}

export interface Canvas2DBaseProps<TItem = unknown> {
  // May return a cleanup function, which runs before the next init and on unmount.
  onInit?: (args: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
  }) => void | (() => void);
  onDraw: (args: Canvas2DDrawArgs) => void;
  // Takes world coordinates and returns the object there, or null.
  hitTest?: (
    point: Point,
    args: { width: number; height: number; viewport: Viewport },
  ) => TItem | null;

  onItemClick?: (item: TItem, event: PointerEvent) => void;
  onItemHover?: (item: TItem | null, event: PointerEvent) => void;
  onBackgroundClick?: (point: Point, event: PointerEvent) => void;
  onViewportChange?: (viewport: Viewport) => void;
  onResize?: (size: { width: number; height: number }) => void;

  // `loop` draws every frame; `on-demand` draws only on requestRedraw or a size change,
  // which is what a static floor plan wants.
  renderMode?: "loop" | "on-demand";
  paused?: boolean;
  maxFps?: number;
  pauseWhenHidden?: boolean;

  interaction?: Canvas2DInteractionOptions;
  autoClear?: boolean;
  // Falls back to the theme surface colour.
  backgroundColor?: string;

  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export interface Canvas2DHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getContext: () => CanvasRenderingContext2D | null;
  // Schedules a single frame; only meaningful in on-demand mode.
  requestRedraw: () => void;
  start: () => void;
  stop: () => void;
  getViewport: () => Viewport;
  setViewport: (viewport: Partial<Viewport>) => void;
  resetViewport: () => void;
  // Screen coordinates are CSS pixels relative to the canvas.
  toScreen: (point: Point) => Point;
  toWorld: (point: Point) => Point;
  toDataURL: (type?: string, quality?: number) => string | undefined;
}
