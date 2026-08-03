import type { CSSProperties } from "react";
import type { ECharts, VizEChartsOption } from "../echarts";

/** ECharts 이벤트 핸들러 시그니처 */
export type ChartEventHandler = (params: unknown, chart: ECharts) => void;

/** 자주 쓰는 ECharts 이벤트 이름(문자열 자유 입력도 허용) */
export type ChartEventName =
  | "click"
  | "dblclick"
  | "mouseover"
  | "mouseout"
  | "globalout"
  | "legendselectchanged"
  | "datazoom"
  | "brushselected"
  | "highlight"
  | "downplay"
  | "finished"
  | (string & {});

export interface BaseChartProps {
  /** ECharts setOption 에 전달되는 옵션 */
  option: VizEChartsOption;
  /** true 면 기존 옵션을 병합하지 않고 교체한다(시리즈 개수가 바뀔 때 필요) */
  notMerge?: boolean;
  /** setOption 을 다음 프레임까지 지연시켜 연속 갱신 비용을 줄인다 */
  lazyUpdate?: boolean;
  /** 옵션에서 제거된 컴포넌트를 명시적으로 지우고 싶을 때 사용 */
  replaceMerge?: string[];

  loading?: boolean;
  loadingText?: string;

  /** Provider 테마 대신 사용할 등록된 ECharts 테마 이름 */
  themeName?: string;
  /**
   * dirty rect 최적화. 부분 갱신이 잦은 실시간 차트에서 유효하다.
   * (인스턴스 생성 시점에만 반영되므로 변경 시 재생성된다.)
   */
  useDirtyRect?: boolean;
  /** 여러 차트의 축/툴팁을 연동하는 그룹 이름 */
  group?: string;

  /** ECharts 이벤트 바인딩. 언마운트 시 자동 off 된다. */
  events?: Partial<Record<ChartEventName, ChartEventHandler>>;
  /** zrender 레벨 이벤트(빈 영역 클릭 감지 등) */
  zrEvents?: Partial<
    Record<"click" | "mousemove" | "mouseout" | "dblclick", ChartEventHandler>
  >;

  onReady?: (chart: ECharts) => void;
  /** 컨테이너 크기 변경 후 resize 완료 시 호출 */
  onResize?: (size: { width: number; height: number }, chart: ECharts) => void;

  autoResize?: boolean;
  /** resize 디바운스(ms). 리사이즈 드래그 중 과도한 재계산을 막는다. */
  resizeDebounceMs?: number;

  className?: string;
  style?: CSSProperties;
  /** 컨테이너에 부여할 접근성 라벨 */
  ariaLabel?: string;
}

export interface BaseChartHandle {
  /** ECharts 인스턴스. 언마운트 후에는 null. */
  getInstance: () => ECharts | null;
  resize: () => void;
  /** 대용량 스트리밍 시 setOption 대신 사용하는 증분 추가 API */
  appendData: (params: { seriesIndex: number; data: unknown[] }) => void;
  /** PNG dataURL 추출(리포트 캡처용) */
  toDataURL: (opts?: {
    pixelRatio?: number;
    backgroundColor?: string;
  }) => string | undefined;
  clear: () => void;
}
