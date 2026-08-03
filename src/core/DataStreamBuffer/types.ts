/** 버퍼 방출 전략 */
export type FlushMode =
  /** 지정 주기마다 그동안 쌓인 데이터를 일괄 방출(실시간 차트 기본값) */
  | "throttle"
  /** 마지막 push 후 조용해지면 방출(배치 로딩·검색 입력 등) */
  | "debounce"
  /** 버퍼가 batchSize 에 도달하면 즉시 방출 */
  | "batch";

export type OverflowPolicy = "drop-oldest" | "drop-newest";

export interface DataStreamBufferOptions<T> {
  /** flush 주기(ms). throttle/debounce 모드에서 사용. 기본 200ms(=5fps 갱신) */
  interval?: number;
  mode?: FlushMode;
  /** batch 모드에서 방출 기준 개수 */
  batchSize?: number;
  /** 버퍼 최대 보관 개수. 초과 시 overflow 정책에 따라 폐기 */
  capacity?: number;
  overflow?: OverflowPolicy;
  /** 1회 flush 에서 방출할 최대 개수(렌더 폭주 방지) */
  maxFlushSize?: number;
  /**
   * 방출 직전 변환. 다운샘플링·집계·정렬 등에 사용한다.
   * 예: `(items) => lttb(items, 500, p => p.time, p => p.value)`
   */
  transform?: (items: T[]) => T[];
  /**
   * true 면 flush 타이밍을 rAF 에 정렬한다(기본 true).
   * 브라우저 렌더 주기와 맞물려 프레임 드랍을 줄이고, 백그라운드 탭에서 자동으로 느려진다.
   */
  alignToFrame?: boolean;
  /** 탭이 백그라운드일 때 flush 를 멈추고 버퍼링만 수행(기본 true) */
  pauseWhenHidden?: boolean;
  /** 시작 시 자동 start (기본 true) */
  autoStart?: boolean;
}

export interface BufferStats {
  received: number;
  flushed: number;
  dropped: number;
  bufferSize: number;
  lastFlushAt: number;
  /** 최근 1초 기준 수신 처리량(items/sec) */
  inboundRate: number;
}

export type BufferListener<T> = (items: T[], stats: BufferStats) => void;

/**
 * 외부 스트림 소스 추상화. WebSocket/SSE/Mock 이 동일 인터페이스를 구현한다.
 * `subscribe` 는 구독 해제 함수를 반환해야 한다.
 */
export interface StreamSource<T> {
  subscribe: (handler: (item: T) => void) => () => void;
  /** 연결 상태 변화 알림(선택) */
  onStatusChange?: (handler: (status: StreamStatus) => void) => () => void;
  close?: () => void;
}

export type StreamStatus = "connecting" | "open" | "closed" | "error";
