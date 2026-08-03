import type { VizEventMap } from "./events";

type Handler<P> = (payload: P) => void;

/**
 * 타입 안전 이벤트 버스.
 *
 * 대시보드 위젯끼리 props drilling 없이 느슨하게 연동하기 위한 채널.
 * 상태를 "보관"해야 하는 값은 EventBus 가 아니라 스토어(useVizStore)에 둔다.
 * EventBus 는 어디까지나 "발생한 사건"을 전달한다.
 */
export class EventBus<M extends object = VizEventMap> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  once<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof M>(event: K, handler: Handler<M[K]>): void {
    const set = this.handlers.get(event);
    if (!set) return;
    set.delete(handler as Handler<never>);
    if (set.size === 0) this.handlers.delete(event);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // 핸들러가 자기 자신을 해제하는 경우를 대비해 복사본을 순회한다.
    for (const handler of [...set]) {
      try {
        (handler as Handler<M[K]>)(payload);
      } catch (error) {
        console.error(`[EventBus] handler error on "${String(event)}"`, error);
      }
    }
  }

  clear(event?: keyof M): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }

  listenerCount(event: keyof M): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

/** 애플리케이션 기본 버스. 격리가 필요하면 새 인스턴스를 만들어 Provider 로 주입한다. */
export const vizEventBus = new EventBus();
