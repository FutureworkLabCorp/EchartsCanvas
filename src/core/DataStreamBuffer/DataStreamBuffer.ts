import type {
  BufferListener,
  BufferStats,
  DataStreamBufferOptions,
  FlushMode,
  OverflowPolicy,
  StreamSource,
} from "./types";

// Decouples arrival rate from repaint rate. A sensor sending hundreds to thousands of
// samples a second would pin the main thread if each one triggered a repaint, so intake
// is O(1) into the buffer and emission happens once per interval or per batch.
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

  // Returns its own disconnect.
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

  subscribe(listener: BufferListener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // A no-op on an empty buffer unless forced, which notifies with an empty array.
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
        // One listener throwing must not stop the rest from being notified.
        console.error("[DataStreamBuffer] listener error", error);
      }
    }
  }

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

  // Releases timers, listeners and the source. Nothing else does, so an unmount that
  // skips this leaks the stream for the life of the page.
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

  private enqueue(item: T): void {
    if (this.buffer.length >= this.capacity) {
      // Bounded like a ring buffer: something has to be discarded to hold the cap.
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
    // debounce reschedules from push, so rescheduling here would emit twice.
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

  get lastTick(): number {
    return this.lastTickAt;
  }
}
