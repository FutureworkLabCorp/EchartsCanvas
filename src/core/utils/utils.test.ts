import { describe, expect, it } from "vitest";
import { RingBuffer } from "./RingBuffer";
import { lttb, minMaxDownsample } from "./downsample";
import { EventBus } from "../EventBus/EventBus";

describe("RingBuffer", () => {
  it("capacity 를 넘으면 가장 오래된 값을 밀어낸다", () => {
    const ring = new RingBuffer<number>(3);
    ring.pushMany([1, 2, 3, 4, 5]);

    expect(ring.length).toBe(3);
    expect(ring.toArray()).toEqual([3, 4, 5]);
    expect(ring.last).toBe(5);
    expect(ring.isFull).toBe(true);
  });

  it("clear 후 상태가 초기화된다", () => {
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

  it("lttb 는 목표 개수로 줄이고 양 끝점을 유지한다", () => {
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

  it("threshold 가 원본보다 크면 원본을 그대로 반환한다", () => {
    const result = lttb(
      data,
      5000,
      (p) => p[0],
      (p) => p[1],
    );
    expect(result).toHaveLength(data.length);
  });

  it("minMaxDownsample 은 극값을 보존한다", () => {
    const spiky: Array<[number, number]> = Array.from(
      { length: 500 },
      (_, i) => [i, i === 250 ? 999 : 1],
    );
    const result = minMaxDownsample(spiky, 50, (p) => p[1]);
    expect(result.some(([, value]) => value === 999)).toBe(true);
  });
});

describe("EventBus", () => {
  it("emit 된 페이로드를 구독자에게 전달하고 off 로 해제한다", () => {
    const bus = new EventBus<{ ping: { count: number } }>();
    const received: number[] = [];
    const off = bus.on("ping", (payload) => received.push(payload.count));

    bus.emit("ping", { count: 1 });
    off();
    bus.emit("ping", { count: 2 });

    expect(received).toEqual([1]);
    expect(bus.listenerCount("ping")).toBe(0);
  });

  it("once 는 1회만 수신한다", () => {
    const bus = new EventBus<{ ping: number }>();
    const received: number[] = [];
    bus.once("ping", (value) => received.push(value));

    bus.emit("ping", 1);
    bus.emit("ping", 2);

    expect(received).toEqual([1]);
  });

  it("구독자 예외가 다른 구독자에게 전파되지 않는다", () => {
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
