import type { StreamSource, StreamStatus } from "./types";

interface SocketLike {
  addEventListener: (type: string, listener: (event: any) => void) => void;
  removeEventListener: (type: string, listener: (event: any) => void) => void;
  close: () => void;
  readyState: number;
}

export interface WebSocketSourceOptions<T> {
  /** 수신 메시지 → 도메인 타입 변환. 기본값은 JSON.parse */
  parse?: (raw: unknown) => T | T[] | null;
  /** 재연결 사용 여부(기본 true) */
  reconnect?: boolean;
  /** 재연결 최초 지연(ms). 실패할수록 2배씩 증가하며 maxDelay 로 상한 */
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  protocols?: string | string[];
  /** 테스트/Mock 주입용 소켓 팩토리 */
  factory?: (url: string, protocols?: string | string[]) => SocketLike;
}

/**
 * WebSocket 스트림 소스. 지수 백오프 재연결과 완전한 리스너 해제를 포함한다.
 * 온프레미스 네트워크 순단 시 대시보드가 스스로 복구되어야 하므로 재연결은 기본 활성이다.
 */
export function createWebSocketSource<T>(
  url: string,
  options: WebSocketSourceOptions<T> = {},
): StreamSource<T> {
  const {
    parse = (raw) => JSON.parse(String(raw)) as T,
    reconnect = true,
    reconnectDelay = 1000,
    maxReconnectDelay = 15_000,
    protocols,
    factory = (u, p) => new WebSocket(u, p) as unknown as SocketLike,
  } = options;

  const dataHandlers = new Set<(item: T) => void>();
  const statusHandlers = new Set<(status: StreamStatus) => void>();

  let socket: SocketLike | null = null;
  let retryDelay = reconnectDelay;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const emitStatus = (status: StreamStatus) => {
    for (const handler of statusHandlers) handler(status);
  };

  const emitData = (payload: T | T[] | null) => {
    if (payload === null) return;
    if (Array.isArray(payload)) {
      for (const item of payload)
        for (const handler of dataHandlers) handler(item);
    } else {
      for (const handler of dataHandlers) handler(payload);
    }
  };

  const connect = () => {
    if (closed) return;
    emitStatus("connecting");

    const ws = factory(url, protocols);
    socket = ws;

    const onOpen = () => {
      retryDelay = reconnectDelay;
      emitStatus("open");
    };
    const onMessage = (event: { data: unknown }) => {
      try {
        emitData(parse(event.data));
      } catch (error) {
        console.error("[createWebSocketSource] parse error", error);
      }
    };
    const onError = () => emitStatus("error");
    const onClose = () => {
      detach();
      emitStatus("closed");
      if (!closed && reconnect) {
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, maxReconnectDelay);
      }
    };

    function detach() {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
    }

    ws.addEventListener("open", onOpen);
    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", onError);
    ws.addEventListener("close", onClose);
  };

  connect();

  return {
    subscribe(handler) {
      dataHandlers.add(handler);
      return () => dataHandlers.delete(handler);
    },
    onStatusChange(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
    close() {
      closed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null;
      socket?.close();
      socket = null;
      dataHandlers.clear();
      statusHandlers.clear();
    },
  };
}

export interface SSESourceOptions<T> {
  parse?: (raw: string) => T | T[] | null;
  /** 구독할 이벤트 이름 목록. 미지정 시 기본 message 이벤트 */
  eventNames?: string[];
  withCredentials?: boolean;
}

/** Server-Sent Events 스트림 소스 */
export function createSSESource<T>(
  url: string,
  options: SSESourceOptions<T> = {},
): StreamSource<T> {
  const {
    parse = (raw) => JSON.parse(raw) as T,
    eventNames = ["message"],
    withCredentials = false,
  } = options;

  const dataHandlers = new Set<(item: T) => void>();
  const statusHandlers = new Set<(status: StreamStatus) => void>();
  const source = new EventSource(url, { withCredentials });

  const onMessage = (event: MessageEvent<string>) => {
    try {
      const parsed = parse(event.data);
      if (parsed === null) return;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items)
        for (const handler of dataHandlers) handler(item);
    } catch (error) {
      console.error("[createSSESource] parse error", error);
    }
  };
  const onOpen = () => statusHandlers.forEach((h) => h("open"));
  const onError = () => statusHandlers.forEach((h) => h("error"));

  for (const name of eventNames)
    source.addEventListener(name, onMessage as EventListener);
  source.addEventListener("open", onOpen);
  source.addEventListener("error", onError);

  return {
    subscribe(handler) {
      dataHandlers.add(handler);
      return () => dataHandlers.delete(handler);
    },
    onStatusChange(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
    close() {
      for (const name of eventNames)
        source.removeEventListener(name, onMessage as EventListener);
      source.removeEventListener("open", onOpen);
      source.removeEventListener("error", onError);
      source.close();
      dataHandlers.clear();
      statusHandlers.clear();
    },
  };
}

/** 임의의 emitter 를 StreamSource 로 감싸는 헬퍼(테스트·Mock 용) */
export function createEmitterSource<T>(): StreamSource<T> & {
  emit: (item: T) => void;
} {
  const handlers = new Set<(item: T) => void>();
  return {
    emit(item) {
      for (const handler of handlers) handler(item);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      handlers.clear();
    },
  };
}
