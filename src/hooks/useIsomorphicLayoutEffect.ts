import { useEffect, useLayoutEffect } from "react";

// useLayoutEffect warns when it runs during SSR, where it cannot do anything anyway.
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
