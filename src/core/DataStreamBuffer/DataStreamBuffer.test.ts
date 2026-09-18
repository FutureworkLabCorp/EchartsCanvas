import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataStreamBuffer } from "./DataStreamBuffer";

describe("DataStreamBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Running the callback inline: real rAF never fires under fake timers, so a
    // frame-aligned flush would simply never happen here.
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

  it("flushes once per interval no matter how many items arrived", () => {
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

  it("discards the oldest items past capacity", () => {
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

  it("flushes as soon as batch mode reaches batchSize", () => {
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

  it("runs transform on the items just before they are emitted", () => {
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

  it("releases timers and subscriptions on dispose", () => {
    const buffer = new DataStreamBuffer<number>({ interval: 50 });
    const listener = vi.fn();
    buffer.subscribe(listener);

    buffer.dispose();
    buffer.push(1);
    vi.advanceTimersByTime(500);

    expect(listener).not.toHaveBeenCalled();
    expect(buffer.isDisposed()).toBe(true);
  });

  it("unsubscribes a connected source through the returned function", () => {
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
