import type {
  StreamSource,
  StreamStatus,
} from "../core/DataStreamBuffer/types";
import type { SensorSample } from "../types/domain";
import { createRandom, gaussian } from "./random";

export interface MockSensorConfig {
  sensorId: string;
  equipmentId?: string;
  /** 기준값 */
  base: number;
  /** 사인파 진폭 */
  amplitude?: number;
  /** 주기(ms) */
  period?: number;
  /** 노이즈 표준편차 */
  noise?: number;
  /** 스파이크 발생 확률(0~1, 샘플당) */
  spikeChance?: number;
  spikeMagnitude?: number;
  /** 서서히 상승하는 드리프트(단위/초) — 임계치 도달 시나리오 재현용 */
  drift?: number;
}

export interface MockSensorStreamOptions {
  sensors: MockSensorConfig[];
  /** 센서당 초당 샘플 수(기본 20Hz). 고주파 테스트는 200~1000 까지 올려본다. */
  hz?: number;
  /** 한 번의 타이머 tick 에서 몰아서 발생시킬 샘플 수(WebSocket 배치 수신 모사) */
  burst?: number;
  seed?: number;
  /** 자동 시작(기본 true) */
  autoStart?: boolean;
}

export interface MockSensorStream extends StreamSource<SensorSample> {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  /** 특정 센서에 즉시 이상값을 주입한다(스토리북 버튼용) */
  injectAnomaly: (sensorId: string, magnitude?: number) => void;
}

/**
 * WebSocket 없이 고주파 센서 스트림을 흉내 내는 Mock 소스.
 * `DataStreamBuffer.connect()` 에 그대로 연결할 수 있다.
 */
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

  const tickInterval = Math.max(1000 / (hz / burst), 8); // 최소 8ms 간격 유지

  const tick = () => {
    const now = Date.now();
    for (let i = 0; i < burst; i += 1) {
      // burst 내 샘플은 시간축을 균등 분할해 배치 수신을 사실적으로 만든다.
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

/**
 * 브라우저 WebSocket API 를 흉내 내는 Mock 소켓.
 * `createWebSocketSource(url, { factory: () => new MockWebSocket(...) })` 로 주입해
 * 실제 서버 없이 재연결 로직까지 검증할 수 있다.
 */
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
