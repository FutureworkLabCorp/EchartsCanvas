import { useEffect, useLayoutEffect } from "react";

/** SSR 환경에서 useLayoutEffect 경고를 피하기 위한 폴백 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
