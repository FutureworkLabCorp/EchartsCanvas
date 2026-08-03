import type { CSSProperties } from "react";
import type { FrameInfo } from "../../hooks/useAnimationLoop";
import type { VizTheme } from "../../theme/types";

export interface Point {
  x: number;
  y: number;
}

/** 월드 좌표 → 화면 좌표 변환 상태 (scale 후 offset 적용) */
export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Canvas2DDrawArgs {
  /** DPR 스케일 및 viewport 변환이 적용된 컨텍스트. 콜백은 월드 좌표계로 그리면 된다. */
  ctx: CanvasRenderingContext2D;
  /** CSS 픽셀 기준 캔버스 크기 */
  width: number;
  height: number;
  dpr: number;
  viewport: Viewport;
  frame: FrameInfo;
  theme: VizTheme;
  /** 현재 hover 중인 아이템(hitTest 결과) */
  hovered: unknown;
}

export interface Canvas2DInteractionOptions {
  pan?: boolean;
  zoom?: boolean;
  minScale?: number;
  maxScale?: number;
  /** 휠 1 노치당 확대 비율 */
  zoomStep?: number;
}

export interface Canvas2DBaseProps<TItem = unknown> {
  /** 인스턴스 초기화(이미지 프리로드 등). cleanup 함수를 반환할 수 있다. */
  onInit?: (args: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
  }) => void | (() => void);
  /** 매 프레임 호출되는 렌더 함수 */
  onDraw: (args: Canvas2DDrawArgs) => void;
  /** 월드 좌표를 받아 해당 위치의 객체를 반환한다. 없으면 null. */
  hitTest?: (
    point: Point,
    args: { width: number; height: number; viewport: Viewport },
  ) => TItem | null;

  onItemClick?: (item: TItem, event: PointerEvent) => void;
  onItemHover?: (item: TItem | null, event: PointerEvent) => void;
  onBackgroundClick?: (point: Point, event: PointerEvent) => void;
  onViewportChange?: (viewport: Viewport) => void;
  /** 캔버스 크기 변경 후 호출(초기 fit 계산 등에 사용) */
  onResize?: (size: { width: number; height: number }) => void;

  /**
   * `loop`      : 매 프레임 렌더(애니메이션 필요 시)
   * `on-demand` : requestRedraw() 또는 크기/상태 변화 시에만 렌더(정적 도면)
   */
  renderMode?: "loop" | "on-demand";
  /** loop 모드에서 일시 정지 */
  paused?: boolean;
  maxFps?: number;
  /** 탭이 백그라운드일 때 렌더 중단(기본 true) */
  pauseWhenHidden?: boolean;

  interaction?: Canvas2DInteractionOptions;
  /** 각 프레임 시작 시 배경을 지운다(기본 true) */
  autoClear?: boolean;
  /** 배경 채움 색. 미지정 시 테마 surface */
  backgroundColor?: string;

  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export interface Canvas2DHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getContext: () => CanvasRenderingContext2D | null;
  /** on-demand 모드에서 1회 렌더를 예약한다 */
  requestRedraw: () => void;
  start: () => void;
  stop: () => void;
  getViewport: () => Viewport;
  setViewport: (viewport: Partial<Viewport>) => void;
  resetViewport: () => void;
  /** 월드 좌표 → 화면(CSS 픽셀) 좌표 */
  toScreen: (point: Point) => Point;
  /** 화면(CSS 픽셀) 좌표 → 월드 좌표 */
  toWorld: (point: Point) => Point;
  toDataURL: (type?: string, quality?: number) => string | undefined;
}
