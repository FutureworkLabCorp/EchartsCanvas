import type {
  StreamSource,
  StreamStatus,
} from "../core/DataStreamBuffer/types";
import type { SensorSample } from "../types/domain";
import { createRandom, gaussian } from "./random";

export interface MockSensorConfig {
  sensorId: string;
  equipmentId?: string;
  base: number;
  amplitude?: number;
  period?: number;
  noise?: number;
  // Per sample, in 0..1.
  spikeChance?: number;
  spikeMagnitude?: number;
  // Units per second. Lets a run reach a threshold on its own rather than by a spike.
  drift?: number;
}

export interface MockSensorStreamOptions {
  sensors: MockSensorConfig[];
  // Samples per second per sensor. 200-1000 is the range worth testing the buffer at.
  hz?: number;
  // Emitted together on one tick, the way a socket delivers a batched frame.
  burst?: number;
  seed?: number;
  autoStart?: boolean;
}

export interface MockSensorStream extends StreamSource<SensorSample> {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  injectAnomaly: (sensorId: string, magnitude?: number) => void;
}

// A high-rate sensor stream with no socket behind it. Satisfies StreamSource, so it
// connects to a DataStreamBuffer unchanged.
export function createMockSensorStream({
  sensors,
  hz = 20,
  burst = 1,
  seed = 20260803,
  autoStart = true,
}: MockSensorStreamOptions): MockSensorStream {
  const random = createRandom(seed);
  const handlers = new Set<(item: SensorSample) => void>();
  const statusHandlers = new Set<(status: StreamStatus) => void>();
  const drifts = new Map<string, number>();
  const pendingSpikes = new Map<string, number>();

  let timer: ReturnType<typeof setInterval> | null = null;
  const startedAt = Date.now();

  const emit = (sample: SensorSample) => {
    for (const handler of handlers) handler(sample);
  };

  // Floored at 8ms: below that the timer resolution stops being the limiting factor.
  const tickInterval = Math.max(1000 / (hz / burst), 8);

  const tick = () => {
    const now = Date.now();
    for (let i = 0; i < burst; i += 1) {
      // Spreading a burst across the interval, so timestamps are not all identical.
      const time = now - Math.round(((burst - 1 - i) * tickInterval) / burst);

      for (const config of sensors) {
        const {
          sensorId,
          equipmentId,
          base,
          amplitude = base * 0.08,
          period = 12_000,
          noise = base * 0.01,
          spikeChance = 0.0015,
          spikeMagnitude = base * 0.35,
          drift = 0,
        } = config;

        const elapsedSec = (time - startedAt) / 1000;
        const driftValue = (drifts.get(sensorId) ?? 0) + drift / hz;
        drifts.set(sensorId, driftValue);

        let value =
          base +
          Math.sin((elapsedSec * 2 * Math.PI * 1000) / period) * amplitude +
          gaussian(random, 0, noise) +
          driftValue;

        const injected = pendingSpikes.get(sensorId);
        if (injected !== undefined) {
          value += injected;
          pendingSpikes.delete(sensorId);
        } else if (random() < spikeChance) {
          value += spikeMagnitude * (random() > 0.5 ? 1 : -1);
        }

        emit({
          time,
          sensorId,
          equipmentId,
          value: Number(value.toFixed(3)),
          quality: "good",
        });
      }
    }
  };

  const start = () => {
    if (timer !== null) return;
    for (const handler of statusHandlers) handler("open");
    timer = setInterval(tick, tickInterval);
  };

  const stop = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    for (const handler of statusHandlers) handler("closed");
  };

  if (autoStart) start();

  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    onStatusChange(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
    close() {
      stop();
      handlers.clear();
      statusHandlers.clear();
    },
    start,
    stop,
    isRunning: () => timer !== null,
    injectAnomaly(sensorId, magnitude) {
      const config = sensors.find((sensor) => sensor.sensorId === sensorId);
      pendingSpikes.set(
        sensorId,
        magnitude ?? (config ? config.base * 0.6 : 10),
      );
    },
  };
}

// Enough of the WebSocket surface to exercise createWebSocketSource, including its
// reconnect path, without a server. Inject it through that source's `factory` option.
export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  private listeners = new Map<string, Set<(event: any) => void>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly generator: () => SensorSample[],
    private readonly intervalMs = 100,
    openDelayMs = 50,
  ) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatch("open", {});
      this.timer = setInterval(() => {
        this.dispatch("message", { data: JSON.stringify(this.generator()) });
      }, this.intervalMs);
    }, openDelayMs);
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.readyState = MockWebSocket.CLOSED;
    this.dispatch("close", {});
  }

  private dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}
