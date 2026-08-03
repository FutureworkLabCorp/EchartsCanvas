import type {
  BufferListener,
  BufferStats,
  DataStreamBufferOptions,
  FlushMode,
  OverflowPolicy,
  StreamSource,
} from "./types";

/**
 * 고주파 스트림(WebSocket/SSE)과 렌더러 사이의 완충 파이프라인.
 *
 * 문제: 센서가 초당 수백~수천 건을 보내는데 그때마다 setOption 을 호출하면
 * 메인 스레드가 렌더에 묶여 프레임이 무너진다.
 * 해결: 수신은 O(1) 로 버퍼에 적재만 하고, 방출은 일정 주기(또는 배치 단위)로 묶어서 한 번만 수행한다.
 *
 * ```ts
 * const buffer = new DataStreamBuffer<Sample>({ interval: 200, capacity: 5000 });
 * const off = buffer.subscribe((items) => chart.appendSamples(items));
 * const disconnect = buffer.connect(createWebSocketSource(url));
 * // 정리
 * off(); disconnect(); buffer.dispose();
 * ```
 */
export class DataStreamBuffer<T> {
  private buffer: T[] = [];
  private listeners = new Set<BufferListener<T>>();
  private sourceCleanups = new Set<() => void>();

  private readonly interval: number;
  private readonly mode: FlushMode;
  private readonly batchSize: number;
  private readonly capacity: number;
  private readonly overflow: OverflowPolicy;
  private readonly maxFlushSize: number;
  private readonly transform: ((items: T[]) => T[]) | undefined;
  private readonly alignToFrame: boolean;
  private readonly pauseWhenHidden: boolean;

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private running = false;
  private disposed = false;
  private lastTickAt = 0;

  private stats: BufferStats = {
    received: 0,
    flushed: 0,
    dropped: 0,
    bufferSize: 0,
    lastFlushAt: 0,
    inboundRate: 0,
  };
  private rateWindowStart = 0;
  private rateWindowCount = 0;

  private readonly onVisibilityChange = () => {
    if (!this.pauseWhenHidden) return;
    if (document.hidden) this.pauseTick();
    else if (this.running) this.scheduleTick();
  };

  constructor(options: DataStreamBufferOptions<T> = {}) {
    const {
      interval = 200,
      mode = "throttle",
      batchSize = 64,
      capacity = 10_000,
      overflow = "drop-oldest",
      maxFlushSize = Number.POSITIVE_INFINITY,
      transform,
      alignToFrame = true,
      pauseWhenHidden = true,
      autoStart = true,
    } = options;

    this.interval = Math.max(0, interval);
    this.mode = mode;
    this.batchSize = Math.max(1, batchSize);
    this.capacity = Math.max(1, capacity);
    this.overflow = overflow;
    this.maxFlushSize = maxFlushSize;
    this.transform = transform;
    this.alignToFrame = alignToFrame;
    this.pauseWhenHidden = pauseWhenHidden;

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
    if (autoStart) this.start();
  }

  // --- 입력 -----------------------------------------------------------------

  push(item: T): void {
    if (this.disposed) return;
    this.enqueue(item);
    this.afterEnqueue();
  }

  pushMany(items: readonly T[]): void {
    if (this.disposed || items.length === 0) return;
    for (const item of items) this.enqueue(item);
    this.afterEnqueue();
  }

  /** 스트림 소스를 연결한다. 반환된 함수를 호출하면 구독이 해제된다. */
  connect(source: StreamSource<T>): () => void {
    const unsubscribe = source.subscribe((item) => this.push(item));
    const cleanup = () => {
      unsubscribe();
      source.close?.();
      this.sourceCleanups.delete(cleanup);
    };
    this.sourceCleanups.add(cleanup);
    return cleanup;
  }

  // --- 출력 -----------------------------------------------------------------

  subscribe(listener: BufferListener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 즉시 방출한다. 버퍼가 비어 있으면 아무 일도 하지 않는다(force=true 면 빈 배열도 통지). */
  flush(force = false): void {
    if (this.disposed) return;
    if (this.buffer.length === 0 && !force) return;

    const count = Math.min(this.buffer.length, this.maxFlushSize);
    const chunk = this.buffer.splice(0, count);
    const payload = this.transform ? this.transform(chunk) : chunk;

    this.stats.flushed += payload.length;
    this.stats.bufferSize = this.buffer.length;
    this.stats.lastFlushAt = Date.now();

    for (const listener of this.listeners) {
      try {
        listener(payload, this.getStats());
      } catch (error) {
        // 구독자 하나의 예외가 파이프라인 전체를 죽이지 않도록 격리한다.
        console.error("[DataStreamBuffer] listener error", error);
      }
    }
  }

  // --- 제어 -----------------------------------------------------------------

  start(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    if (this.mode !== "batch") this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    this.pauseTick();
  }

  clear(): void {
    this.buffer.length = 0;
    this.stats.bufferSize = 0;
  }

  /** 모든 타이머·구독·소스를 해제한다. 언마운트 시 반드시 호출한다. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    for (const cleanup of [...this.sourceCleanups]) cleanup();
    this.sourceCleanups.clear();
    this.listeners.clear();
    this.buffer.length = 0;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  getStats(): BufferStats {
    return { ...this.stats };
  }

  get size(): number {
    return this.buffer.length;
  }

  // --- 내부 -----------------------------------------------------------------

  private enqueue(item: T): void {
    if (this.buffer.length >= this.capacity) {
      // 링버퍼처럼 동작: 오래된 값을 버려 메모리 상한을 지킨다.
      if (this.overflow === "drop-oldest") this.buffer.shift();
      else {
        this.stats.dropped += 1;
        return;
      }
      this.stats.dropped += 1;
    }
    this.buffer.push(item);
    this.stats.received += 1;
    this.stats.bufferSize = this.buffer.length;
    this.trackRate();
  }

  private afterEnqueue(): void {
    if (!this.running) return;
    if (this.mode === "batch") {
      if (this.buffer.length >= this.batchSize) this.flush();
      return;
    }
    if (this.mode === "debounce") this.scheduleTick();
  }

  private trackRate(): void {
    const now = Date.now();
    if (this.rateWindowStart === 0) this.rateWindowStart = now;
    this.rateWindowCount += 1;
    const elapsed = now - this.rateWindowStart;
    if (elapsed >= 1000) {
      this.stats.inboundRate = Math.round(
        (this.rateWindowCount * 1000) / elapsed,
      );
      this.rateWindowStart = now;
      this.rateWindowCount = 0;
    }
  }

  private scheduleTick(): void {
    if (!this.running || this.disposed) return;
    if (
      this.pauseWhenHidden &&
      typeof document !== "undefined" &&
      document.hidden
    )
      return;
    this.pauseTick();

    this.timerId = setTimeout(() => {
      this.timerId = null;
      if (this.alignToFrame && typeof requestAnimationFrame === "function") {
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          this.onTick();
        });
      } else {
        this.onTick();
      }
    }, this.interval);
  }

  private onTick(): void {
    if (!this.running || this.disposed) return;
    this.lastTickAt = Date.now();
    this.flush();
    // debounce 는 push 가 다시 예약하므로 여기서는 재예약하지 않는다.
    if (this.mode === "throttle") this.scheduleTick();
  }

  private pauseTick(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** 디버깅용: 마지막 tick 시각 */
  get lastTick(): number {
    return this.lastTickAt;
  }
}
