import { useEffect, useRef } from "react";
import { useEventCallback } from "./useEventCallback";

export interface FrameInfo {
  // ms since the loop started.
  elapsed: number;
  // ms since the previous frame.
  delta: number;
  frame: number;
}

export interface UseAnimationLoopOptions {
  running?: boolean;
  // 0 or unset follows the display refresh rate.
  maxFps?: number;
  // Stopping while hidden matters on a screen left running for days: the loop would
  // otherwise keep burning CPU and GPU drawing frames nobody sees.
  pauseWhenHidden?: boolean;
}

export interface AnimationLoopHandle {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

// Binds a requestAnimationFrame loop to the component lifecycle: cancelled on unmount
// and on stop, and suspended through visibilitychange while the tab is hidden.
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
