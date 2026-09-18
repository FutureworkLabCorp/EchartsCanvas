import type { VizEventMap } from "./events";

type Handler<P> = (payload: P) => void;

// Carries events that happened; anything that has to be read back later belongs in the
// store instead, because a listener that subscribes after the fact never sees it.
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
    // Iterating a copy, because a handler is allowed to call off() on itself.
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

// Module-level, so two dashboards on one page share it and SSR would share it across
// requests. Construct an EventBus directly wherever that matters.
export const vizEventBus = new EventBus();
