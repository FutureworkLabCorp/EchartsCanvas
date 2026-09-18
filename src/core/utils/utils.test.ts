import { describe, expect, it } from "vitest";
import { RingBuffer } from "./RingBuffer";
import { lttb, minMaxDownsample } from "./downsample";
import { EventBus } from "../EventBus/EventBus";

describe("RingBuffer", () => {
  it("drops the oldest value once capacity is exceeded", () => {
    const ring = new RingBuffer<number>(3);
    ring.pushMany([1, 2, 3, 4, 5]);

    expect(ring.length).toBe(3);
    expect(ring.toArray()).toEqual([3, 4, 5]);
    expect(ring.last).toBe(5);
    expect(ring.isFull).toBe(true);
  });

  it("resets to empty after clear", () => {
    const ring = new RingBuffer<number>(2);
    ring.pushMany([1, 2]);
    ring.clear();
    expect(ring.length).toBe(0);
    expect(ring.toArray()).toEqual([]);
  });
});

describe("downsample", () => {
  const data: Array<[number, number]> = Array.from({ length: 1000 }, (_, i) => [
    i,
    Math.sin(i / 20) * 10,
  ]);

  it("reduces to the target count while keeping both endpoints", () => {
    const result = lttb(
      data,
      100,
      (p) => p[0],
      (p) => p[1],
    );
    expect(result).toHaveLength(100);
    expect(result[0]).toEqual(data[0]);
    expect(result[result.length - 1]).toEqual(data[data.length - 1]);
  });

  it("returns the input untouched when the threshold exceeds its length", () => {
    const result = lttb(
      data,
      5000,
      (p) => p[0],
      (p) => p[1],
    );
    expect(result).toHaveLength(data.length);
  });

  it("keeps a single-sample spike", () => {
    const spiky: Array<[number, number]> = Array.from(
      { length: 500 },
      (_, i) => [i, i === 250 ? 999 : 1],
    );
    const result = minMaxDownsample(spiky, 50, (p) => p[1]);
    expect(result.some(([, value]) => value === 999)).toBe(true);
  });
});

describe("EventBus", () => {
  it("delivers a payload to subscribers and stops after off", () => {
    const bus = new EventBus<{ ping: { count: number } }>();
    const received: number[] = [];
    const off = bus.on("ping", (payload) => received.push(payload.count));

    bus.emit("ping", { count: 1 });
    off();
    bus.emit("ping", { count: 2 });

    expect(received).toEqual([1]);
    expect(bus.listenerCount("ping")).toBe(0);
  });

  it("delivers to a once listener exactly once", () => {
    const bus = new EventBus<{ ping: number }>();
    const received: number[] = [];
    bus.once("ping", (value) => received.push(value));

    bus.emit("ping", 1);
    bus.emit("ping", 2);

    expect(received).toEqual([1]);
  });

  it("isolates a throwing listener from the rest", () => {
    const bus = new EventBus<{ ping: number }>();
    const ok = [] as number[];
    bus.on("ping", () => {
      throw new Error("boom");
    });
    bus.on("ping", (value) => ok.push(value));

    expect(() => bus.emit("ping", 1)).not.toThrow();
    expect(ok).toEqual([1]);
  });
});
