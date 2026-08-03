import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { ForwardedRef, ReactElement } from "react";
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
/** 이 픽셀 이상 움직이면 클릭이 아니라 패닝으로 간주 */
const DRAG_THRESHOLD = 4;

function Canvas2DBaseInner<TItem>(
  {
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
  }: Canvas2DBaseProps<TItem>,
  ref: ForwardedRef<Canvas2DHandle>,
) {
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

  // --- 렌더 ------------------------------------------------------------------
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

  // --- 캔버스 초기화 / 크기 동기화 -------------------------------------------
  const syncCanvasSize = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas || width === 0 || height === 0) return;

      // 고DPI 화면(관제 대형 모니터)에서 선명도를 유지하기 위해 backing store 를 DPR 배율로 잡는다.
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
      // 캔버스 backing store 해제 힌트 (Safari 에서 메모리 회수를 돕는다)
      canvas.width = 0;
      canvas.height = 0;
      ctxRef.current = null;
    };
    // initCb/syncCanvasSize 는 안정 참조이므로 마운트 시 1회만 실행된다.
  }, [initCb, syncCanvasSize]);

  useResizeObserver(rootRef, (size) => syncCanvasSize(size.width, size.height));

  // --- 좌표 변환 --------------------------------------------------------------
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

  // --- 포인터 인터랙션 --------------------------------------------------------
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

      // 커서 지점의 월드 좌표가 고정되도록 offset 을 보정한다.
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

  // on-demand 모드에서 테마가 바뀌면 다시 그린다.
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
}

/**
 * HTML5 Canvas 2D 기반 컴포넌트의 공통 래퍼.
 *
 * 책임
 * 1. DPR 대응 캔버스 크기 동기화 + ResizeObserver 재계산
 * 2. rAF 애니메이션 루프 관리(언마운트·백그라운드 탭에서 자동 중단)
 * 3. Hit Detection: 포인터 좌표를 월드 좌표로 역변환해 `hitTest` 에 위임
 * 4. Pan/Zoom 뷰포트 변환 및 모든 리스너의 확실한 해제
 */
export const Canvas2DBase = forwardRef(Canvas2DBaseInner) as <TItem = unknown>(
  props: Canvas2DBaseProps<TItem> & { ref?: ForwardedRef<Canvas2DHandle> },
) => ReactElement;
