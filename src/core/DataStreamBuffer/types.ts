// throttle: emit whatever accumulated, every `interval`.
// debounce: emit once the pushes stop for `interval`.
// batch: emit as soon as `batchSize` is reached, ignoring the clock.
export type FlushMode = "throttle" | "debounce" | "batch";

export type OverflowPolicy = "drop-oldest" | "drop-newest";

export interface DataStreamBufferOptions<T> {
  // Milliseconds; throttle and debounce only. The 200ms default is a 5fps repaint,
  // which is below the rate at which a moving line reads as motion anyway.
  interval?: number;
  mode?: FlushMode;
  batchSize?: number;
  // Past this, `overflow` decides which end gets discarded.
  capacity?: number;
  overflow?: OverflowPolicy;
  // Caps one flush so a burst cannot hand the renderer more than it can draw.
  maxFlushSize?: number;
  // Runs just before emitting — downsample, aggregate or sort here.
  transform?: (items: T[]) => T[];
  // Aligning flushes to rAF matches the browser's paint cadence and inherits its
  // automatic slowdown in background tabs.
  alignToFrame?: boolean;
  // Keeps buffering while hidden, but stops emitting.
  pauseWhenHidden?: boolean;
  autoStart?: boolean;
}

export interface BufferStats {
  received: number;
  flushed: number;
  dropped: number;
  bufferSize: number;
  lastFlushAt: number;
  // items/sec over the last second, not since start.
  inboundRate: number;
}

export type BufferListener<T> = (items: T[], stats: BufferStats) => void;

// The one shape a stream has to satisfy to feed a buffer. The library never opens a
// connection itself — an on-premises deployment supplies the transport.
export interface StreamSource<T> {
  // Returns its own unsubscribe.
  subscribe: (handler: (item: T) => void) => () => void;
  onStatusChange?: (handler: (status: StreamStatus) => void) => () => void;
  close?: () => void;
}

export type StreamStatus = "connecting" | "open" | "closed" | "error";
