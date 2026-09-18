import { useCallback, useRef } from "react";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

// A stable reference that always calls the latest closure, so an rAF loop or a listener
// reads current props without being torn down and re-registered on every render.
export function useEventCallback<A extends unknown[], R>(
  fn: ((...args: A) => R) | undefined,
): (...args: A) => R | undefined {
  const ref = useRef<((...args: A) => R) | undefined>(fn);

  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  });

  return useCallback((...args: A) => ref.current?.(...args), []);
}
