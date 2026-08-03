import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataStreamBuffer } from "./DataStreamBuffer";

describe("DataStreamBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // rAF 정렬은 타이머 테스트에서 비결정적이므로 즉시 실행으로 대체한다.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("throttle 모드에서 유입 건수와 무관하게 주기당 1회만 방출한다", () => {
    const buffer = new DataStreamBuffer<number>({
      interval: 100,
      mode: "throttle",
    });
    const listener = vi.fn();
    buffer.subscribe(listener);

    for (let i = 0; i < 500; i += 1) buffer.push(i);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toHaveLength(500);

    buffer.dispose();
  });

  it("capacity 초과 시 오래된 데이터를 폐기한다", () => {
    const buffer = new DataStreamBuffer<number>({ interval: 50, capacity: 10 });
    const listener = vi.fn();
    buffer.subscribe(listener);

    for (let i = 0; i < 25; i += 1) buffer.push(i);
    vi.advanceTimersByTime(50);

    const emitted = listener.mock.calls[0]?.[0] as number[];
    expect(emitted).toHaveLength(10);
    expect(emitted[0]).toBe(15);
    expect(buffer.getStats().dropped).toBe(15);

    buffer.dispose();
  });

  it("batch 모드는 batchSize 도달 즉시 방출한다", () => {
    const buffer = new DataStreamBuffer<number>({
      mode: "batch",
      batchSize: 5,
    });
    const listener = vi.fn();
    buffer.subscribe(listener);

    buffer.pushMany([1, 2, 3, 4]);
    expect(listener).not.toHaveBeenCalled();

    buffer.push(5);
    expect(listener).toHaveBeenCalledTimes(1);

    buffer.dispose();
  });

  it("transform 으로 방출 직전 데이터를 가공한다", () => {
    const buffer = new DataStreamBuffer<number>({
      interval: 50,
      transform: (items) => items.filter((value) => value % 2 === 0),
    });
    const listener = vi.fn();
    buffer.subscribe(listener);

    buffer.pushMany([1, 2, 3, 4, 5, 6]);
    vi.advanceTimersByTime(50);

    expect(listener.mock.calls[0]?.[0]).toEqual([2, 4, 6]);
    buffer.dispose();
  });

  it("dispose 후에는 타이머와 구독이 모두 해제된다", () => {
    const buffer = new DataStreamBuffer<number>({ interval: 50 });
    const listener = vi.fn();
    buffer.subscribe(listener);

    buffer.dispose();
    buffer.push(1);
    vi.advanceTimersByTime(500);

    expect(listener).not.toHaveBeenCalled();
    expect(buffer.isDisposed()).toBe(true);
  });

  it("connect 로 연결한 소스는 반환 함수로 구독 해제된다", () => {
    const buffer = new DataStreamBuffer<number>({ interval: 50 });
    const listener = vi.fn();
    buffer.subscribe(listener);

    const emitters: Array<(value: number) => void> = [];
    const unsubscribe = vi.fn();
    const disconnect = buffer.connect({
      subscribe: (handler) => {
        emitters.push(handler);
        return unsubscribe;
      },
    });

    emitters[0]?.(1);
    vi.advanceTimersByTime(50);
    expect(listener).toHaveBeenCalledTimes(1);

    disconnect();
    expect(unsubscribe).toHaveBeenCalled();
    buffer.dispose();
  });
});
