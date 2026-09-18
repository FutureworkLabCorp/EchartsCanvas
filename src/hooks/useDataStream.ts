import { useEffect, useMemo, useRef, useState } from "react";
import { DataStreamBuffer } from "../core/DataStreamBuffer/DataStreamBuffer";
import type {
  BufferStats,
  DataStreamBufferOptions,
  StreamSource,
} from "../core/DataStreamBuffer/types";
import { useEventCallback } from "./useEventCallback";

export interface UseDataStreamOptions<T> extends DataStreamBufferOptions<T> {
  // A function form is invoked once on mount.
  source?: StreamSource<T> | (() => StreamSource<T>) | null;
  onFlush?: (items: T[], stats: BufferStats) => void;
  // Off by default: surfacing stats as state re-renders the subscriber on every flush.
  exposeStats?: boolean;
  enabled?: boolean;
}

export interface UseDataStreamResult<T> {
  buffer: DataStreamBuffer<T>;
  stats: BufferStats | null;
  push: (item: T) => void;
}

// Ties a DataStreamBuffer to the component lifecycle: the source is unsubscribed and the
// buffer disposed on unmount.
export function useDataStream<T>({
  source,
  onFlush,
  exposeStats = false,
  enabled = true,
  ...bufferOptions
}: UseDataStreamOptions<T>): UseDataStreamResult<T> {
  const flushCb = useEventCallback(onFlush);
  const [stats, setStats] = useState<BufferStats | null>(null);

  // Pinned to the first value: rebuilding the buffer would drop the connection and
  // everything still sitting in it.
  const optionsRef = useRef(bufferOptions);
  const buffer = useMemo(() => new DataStreamBuffer<T>(optionsRef.current), []);

  useEffect(() => {
    return () => buffer.dispose();
  }, [buffer]);

  useEffect(() => {
    if (!enabled) {
      buffer.stop();
      return;
    }
    buffer.start();
    return buffer.subscribe((items, nextStats) => {
      flushCb(items, nextStats);
      if (exposeStats) setStats(nextStats);
    });
  }, [buffer, enabled, exposeStats, flushCb]);

  useEffect(() => {
    if (!source || !enabled) return;
    const resolved = typeof source === "function" ? source() : source;
    const disconnect = buffer.connect(resolved);
    return () => disconnect();
  }, [buffer, source, enabled]);

  return {
    buffer,
    stats,
    push: (item: T) => buffer.push(item),
  };
}
