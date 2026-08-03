import { useEffect, useRef } from "react";
import { useEventCallback } from "./useEventCallback";

export interface ElementSize {
  width: number;
  height: number;
}

export interface UseResizeObserverOptions {
  /** 연속 resize 이벤트를 묶는 지연(ms). 0 이면 rAF 한 프레임 뒤 실행 */
  debounceMs?: number;
  /** false 면 관측을 중단한다 */
  enabled?: boolean;
}

/**
 * 컨테이너 크기 변화를 관측해 콜백을 호출한다.
 *
 * - ResizeObserver 콜백 안에서 동기적으로 레이아웃을 다시 읽으면
 *   "ResizeObserver loop completed with undelivered notifications" 경고가 발생하므로
 *   항상 rAF/타이머로 한 틱 미뤄 호출한다.
 * - 언마운트 시 observer·타이머를 모두 해제한다.
 */
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
