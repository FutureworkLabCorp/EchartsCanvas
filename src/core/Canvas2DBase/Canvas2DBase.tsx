import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import { useAnimationLoop } from "../../hooks/useAnimationLoop";
import type { FrameInfo } from "../../hooks/useAnimationLoop";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import { useEventCallback } from "../../hooks/useEventCallback";
import { useVizTheme } from "../../theme/ThemeProvider";
import type {
  Canvas2DBaseProps,
  Canvas2DHandle,
  Point,
  Viewport,
} from "./types";

const IDENTITY: Viewport = { scale: 1, offsetX: 0, offsetY: 0 };
// Past this much pointer travel the gesture is a pan, so the pointerup is not a click.
const DRAG_THRESHOLD = 4;

// Owns the parts a canvas view would otherwise re-implement each time: the DPR-correct
// backing store, the rAF loop and its teardown, pointer-to-world inversion for hit
// testing, and pan/zoom. Every listener it adds is removed on unmount, which is what
// lets a kiosk leave one of these mounted for days.
export const Canvas2DBase = <TItem = unknown,>({
  ref,
  onInit,
  onDraw,
  hitTest,
  onItemClick,
  onItemHover,
  onBackgroundClick,
  onViewportChange,
  onResize,
  renderMode = "loop",
  paused = false,
  maxFps = 60,
  pauseWhenHidden = true,
  interaction,
  autoClear = true,
  backgroundColor,
  className,
  style,
  ariaLabel,
}: Canvas2DBaseProps<TItem> & { ref?: Ref<Canvas2DHandle> }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const viewportRef = useRef<Viewport>({ ...IDENTITY });
  const hoveredRef = useRef<TItem | null>(null);
  const oneShotRafRef = useRef<number | null>(null);

  const theme = useVizTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const drawCb = useEventCallback(onDraw);
  const initCb = useEventCallback(onInit);
  const hitTestCb = useEventCallback(hitTest);
  const itemClickCb = useEventCallback(onItemClick);
  const itemHoverCb = useEventCallback(onItemHover);
  const backgroundClickCb = useEventCallback(onBackgroundClick);
  const viewportChangeCb = useEventCallback(onViewportChange);
  const resizeCb = useEventCallback(onResize);

  const {
    pan: panEnabled = false,
    zoom: zoomEnabled = false,
    minScale = 0.25,
    maxScale = 8,
    zoomStep = 1.12,
  } = interaction ?? {};

  const render = useCallback(
    (frame: FrameInfo) => {
      const ctx = ctxRef.current;
      const { width, height, dpr } = sizeRef.current;
      if (!ctx || width === 0 || height === 0) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (autoClear) {
        const bg = backgroundColor ?? themeRef.current.palette.surface;
        if (bg === "transparent") ctx.clearRect(0, 0, width, height);
        else {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, width, height);
        }
      }

      const vp = viewportRef.current;
      ctx.save();
      ctx.translate(vp.offsetX, vp.offsetY);
      ctx.scale(vp.scale, vp.scale);

      drawCb({
        ctx,
        width,
        height,
        dpr,
        viewport: vp,
        frame,
        theme: themeRef.current,
        hovered: hoveredRef.current,
      });

      ctx.restore();
    },
    [autoClear, backgroundColor, drawCb],
  );

  const requestRedraw = useCallback(() => {
    if (oneShotRafRef.current !== null) return;
    oneShotRafRef.current = requestAnimationFrame(() => {
      oneShotRafRef.current = null;
      render({ elapsed: 0, delta: 0, frame: 0 });
    });
  }, [render]);

  const loop = useAnimationLoop(render, {
    running: renderMode === "loop" && !paused,
    maxFps,
    pauseWhenHidden,
  });

  const syncCanvasSize = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas || width === 0 || height === 0) return;

      // The backing store is sized in device pixels while the element stays in CSS pixels,
      // which is what keeps strokes sharp on the high-DPI panels these run on.
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const nextW = Math.round(width * dpr);
      const nextH = Math.round(height * dpr);

      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      sizeRef.current = { width, height, dpr };
      resizeCb({ width, height });
      if (renderMode === "on-demand") requestRedraw();
    },
    [renderMode, requestRedraw, resizeCb],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    ctxRef.current = ctx;
    if (!ctx) return;

    const rect = root.getBoundingClientRect();
    syncCanvasSize(rect.width, rect.height);

    const cleanup = initCb({ ctx, width: rect.width, height: rect.height });

    return () => {
      cleanup?.();
      if (oneShotRafRef.current !== null) {
        cancelAnimationFrame(oneShotRafRef.current);
        oneShotRafRef.current = null;
      }
      // Resizing to 0 is the only reliable hint that frees the backing store in Safari.
      canvas.width = 0;
      canvas.height = 0;
      ctxRef.current = null;
    };
    // initCb and syncCanvasSize are stable, so this runs once per mount.
  }, [initCb, syncCanvasSize]);

  useResizeObserver(rootRef, (size) => syncCanvasSize(size.width, size.height));

  const toWorld = useCallback((p: Point): Point => {
    const { scale, offsetX, offsetY } = viewportRef.current;
    return { x: (p.x - offsetX) / scale, y: (p.y - offsetY) / scale };
  }, []);

  const toScreen = useCallback((p: Point): Point => {
    const { scale, offsetX, offsetY } = viewportRef.current;
    return { x: p.x * scale + offsetX, y: p.y * scale + offsetY };
  }, []);

  const localPoint = useCallback((event: PointerEvent | WheelEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const setViewport = useCallback(
    (next: Partial<Viewport>) => {
      const merged = { ...viewportRef.current, ...next };
      merged.scale = Math.min(maxScale, Math.max(minScale, merged.scale));
      viewportRef.current = merged;
      viewportChangeCb(merged);
      if (renderMode === "on-demand") requestRedraw();
    },
    [maxScale, minScale, renderMode, requestRedraw, viewportChangeCb],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let pointerId: number | null = null;
    let dragging = false;
    let downAt: Point | null = null;
    let downViewport: Viewport | null = null;

    const runHitTest = (screen: Point): TItem | null => {
      const { width, height } = sizeRef.current;
      return (
        (hitTestCb(toWorld(screen), {
          width,
          height,
          viewport: viewportRef.current,
        }) as TItem | null) ?? null
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      downAt = localPoint(event);
      downViewport = { ...viewportRef.current };
      dragging = false;
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const p = localPoint(event);

      if (pointerId === event.pointerId && downAt && downViewport) {
        const dx = p.x - downAt.x;
        const dy = p.y - downAt.y;
        if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragging = true;
        if (dragging && panEnabled) {
          setViewport({
            offsetX: downViewport.offsetX + dx,
            offsetY: downViewport.offsetY + dy,
          });
          return;
        }
      }

      if (dragging) return;

      const hit = runHitTest(p);
      if (hit !== hoveredRef.current) {
        hoveredRef.current = hit;
        canvas.style.cursor = hit ? "pointer" : panEnabled ? "grab" : "default";
        itemHoverCb(hit, event);
        if (renderMode === "on-demand") requestRedraw();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const p = localPoint(event);
      const wasDragging = dragging;

      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      pointerId = null;
      downAt = null;
      downViewport = null;
      dragging = false;

      if (wasDragging) return;

      const hit = runHitTest(p);
      if (hit) itemClickCb(hit, event);
      else backgroundClickCb(toWorld(p), event);
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (hoveredRef.current !== null) {
        hoveredRef.current = null;
        itemHoverCb(null, event);
        if (renderMode === "on-demand") requestRedraw();
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!zoomEnabled) return;
      event.preventDefault();

      const p = localPoint(event);
      const vp = viewportRef.current;
      const factor = event.deltaY < 0 ? zoomStep : 1 / zoomStep;
      const nextScale = Math.min(
        maxScale,
        Math.max(minScale, vp.scale * factor),
      );
      if (nextScale === vp.scale) return;

      // Correcting the offset keeps the world point under the cursor pinned while scaling.
      const world = toWorld(p);
      setViewport({
        scale: nextScale,
        offsetX: p.x - world.x * nextScale,
        offsetY: p.y - world.y * nextScale,
      });
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [
    backgroundClickCb,
    hitTestCb,
    itemClickCb,
    itemHoverCb,
    localPoint,
    maxScale,
    minScale,
    panEnabled,
    renderMode,
    requestRedraw,
    setViewport,
    toWorld,
    zoomEnabled,
    zoomStep,
  ]);

  // on-demand draws nothing on its own, so a theme change needs an explicit frame.
  useEffect(() => {
    if (renderMode === "on-demand") requestRedraw();
  }, [theme, renderMode, requestRedraw]);

  useImperativeHandle(
    ref,
    (): Canvas2DHandle => ({
      getCanvas: () => canvasRef.current,
      getContext: () => ctxRef.current,
      requestRedraw,
      start: loop.start,
      stop: loop.stop,
      getViewport: () => ({ ...viewportRef.current }),
      setViewport,
      resetViewport: () => setViewport({ ...IDENTITY }),
      toScreen,
      toWorld,
      toDataURL: (type = "image/png", quality) =>
        canvasRef.current?.toDataURL(type, quality),
    }),
    [loop.start, loop.stop, requestRedraw, setViewport, toScreen, toWorld],
  );

  return (
    <div
      ref={rootRef}
      className={["viz-canvas2d-root", className].filter(Boolean).join(" ")}
      style={style}
    >
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
};
