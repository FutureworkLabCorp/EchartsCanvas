import { useCallback, useRef } from "react";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

/**
 * 항상 최신 클로저를 호출하지만 참조는 고정되는 콜백.
 * rAF 루프·이벤트 리스너를 재등록하지 않고 최신 props 를 읽기 위해 사용한다.
 */
export function useEventCallback<A extends unknown[], R>(
  fn: ((...args: A) => R) | undefined,
): (...args: A) => R | undefined {
  const ref = useRef<((...args: A) => R) | undefined>(fn);

  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  });

  return useCallback((...args: A) => ref.current?.(...args), []);
}
