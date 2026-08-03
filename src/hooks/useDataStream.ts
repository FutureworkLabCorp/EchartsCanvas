import { useEffect, useMemo, useRef, useState } from "react";
import { DataStreamBuffer } from "../core/DataStreamBuffer/DataStreamBuffer";
import type {
  BufferStats,
  DataStreamBufferOptions,
  StreamSource,
} from "../core/DataStreamBuffer/types";
import { useEventCallback } from "./useEventCallback";

export interface UseDataStreamOptions<T> extends DataStreamBufferOptions<T> {
  /** 연결할 소스. 함수로 주면 마운트 시 1회 생성한다. */
  source?: StreamSource<T> | (() => StreamSource<T>) | null;
  /** flush 될 때마다 호출. 여기서 차트에 데이터를 주입한다. */
  onFlush?: (items: T[], stats: BufferStats) => void;
  /** 통계 상태를 리렌더로 노출할지 여부(기본 false — 불필요한 리렌더 방지) */
  exposeStats?: boolean;
  enabled?: boolean;
}

export interface UseDataStreamResult<T> {
  buffer: DataStreamBuffer<T>;
  stats: BufferStats | null;
  /** 수동 주입(테스트·리플레이용) */
  push: (item: T) => void;
}

/**
 * DataStreamBuffer 를 React 라이프사이클에 결합한다.
 * 언마운트 시 소스 구독 해제 + 버퍼 dispose 를 보장한다.
 */
export function useDataStream<T>({
  source,
  onFlush,
  exposeStats = false,
  enabled = true,
  ...bufferOptions
}: UseDataStreamOptions<T>): UseDataStreamResult<T> {
  const flushCb = useEventCallback(onFlush);
  const [stats, setStats] = useState<BufferStats | null>(null);

  // 옵션 변경으로 버퍼가 재생성되면 스트림이 끊기므로 최초 값으로 고정한다.
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
