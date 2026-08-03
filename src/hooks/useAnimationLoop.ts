import { useEffect, useRef } from "react";
import { useEventCallback } from "./useEventCallback";

export interface FrameInfo {
  /** 루프 시작 이후 경과 시간(ms) */
  elapsed: number;
  /** 직전 프레임과의 간격(ms) */
  delta: number;
  /** 누적 프레임 수 */
  frame: number;
}

export interface UseAnimationLoopOptions {
  /** false 면 루프를 정지한다(기본 true) */
  running?: boolean;
  /** 상한 FPS. 0/undefined 면 디스플레이 주사율을 따른다 */
  maxFps?: number;
  /** 탭이 백그라운드일 때 루프를 멈춘다(기본 true). 24시간 구동 시 CPU/GPU 절약 */
  pauseWhenHidden?: boolean;
}

export interface AnimationLoopHandle {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

/**
 * requestAnimationFrame 루프를 라이프사이클에 안전하게 묶는다.
 * 언마운트·정지 시 rAF 를 반드시 cancel 하며, visibilitychange 로 백그라운드 프레임을 중단한다.
 */
export function useAnimationLoop(
  callback: (info: FrameInfo) => void,
  {
    running = true,
    maxFps = 0,
    pauseWhenHidden = true,
  }: UseAnimationLoopOptions = {},
): AnimationLoopHandle {
  const tick = useEventCallback(callback);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const frameRef = useRef(0);
  const runningRef = useRef(false);

  const handleRef = useRef<AnimationLoopHandle>({
    start: () => {},
    stop: () => {},
    isRunning: () => false,
  });

  useEffect(() => {
    const minInterval = maxFps > 0 ? 1000 / maxFps : 0;

    const loop = (now: number) => {
      if (!runningRef.current) return;
      rafRef.current = requestAnimationFrame(loop);

      if (startedAtRef.current === 0) {
        startedAtRef.current = now;
        lastFrameAtRef.current = now;
      }
      const delta = now - lastFrameAtRef.current;
      if (minInterval > 0 && delta < minInterval) return;

      lastFrameAtRef.current = now;
      frameRef.current += 1;
      tick({
        elapsed: now - startedAtRef.current,
        delta,
        frame: frameRef.current,
      });
    };

    const start = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      lastFrameAtRef.current = performance.now();
      rafRef.current = requestAnimationFrame(loop);
    };

    const stop = () => {
      runningRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    handleRef.current = { start, stop, isRunning: () => runningRef.current };

    const onVisibilityChange = () => {
      if (!pauseWhenHidden) return;
      if (document.hidden) stop();
      else if (running) start();
    };

    if (running && !(pauseWhenHidden && document.hidden)) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [tick, running, maxFps, pauseWhenHidden]);

  return {
    start: () => handleRef.current.start(),
    stop: () => handleRef.current.stop(),
    isRunning: () => handleRef.current.isRunning(),
  };
}
