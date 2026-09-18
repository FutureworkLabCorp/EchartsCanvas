import { useEffect, useRef } from "react";
import { useEventCallback } from "./useEventCallback";

export interface ElementSize {
  width: number;
  height: number;
}

export interface UseResizeObserverOptions {
  // 0 defers to the next animation frame rather than firing synchronously.
  debounceMs?: number;
  enabled?: boolean;
}

// Always defers the callback by a frame or a timer. Reading layout synchronously inside
// a ResizeObserver callback triggers "ResizeObserver loop completed with undelivered
// notifications", and a chart resize does exactly that kind of read.
export function useResizeObserver<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onResize: (size: ElementSize, element: T) => void,
  { debounceMs = 0, enabled = true }: UseResizeObserverOptions = {},
): void {
  const handler = useEventCallback(onResize);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled || typeof ResizeObserver === "undefined") return;

    const cancelPending = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const schedule = () => {
      cancelPending();
      const run = () => {
        const rect = element.getBoundingClientRect();
        handler({ width: rect.width, height: rect.height }, element);
      };
      if (debounceMs > 0) {
        timerRef.current = setTimeout(run, debounceMs);
      } else {
        rafRef.current = requestAnimationFrame(run);
      }
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(element);

    return () => {
      cancelPending();
      observer.disconnect();
    };
  }, [ref, handler, debounceMs, enabled]);
}
