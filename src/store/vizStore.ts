import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useEffect } from "react";
import { vizEventBus } from "../core/EventBus/EventBus";
import { VizEvent } from "../core/EventBus/events";
import type { EquipmentNode, TimeRange } from "../types/domain";

export interface VizState {
  // Charts subscribe to this and swap their dataset from it, rather than being told to.
  selectedEquipment: EquipmentNode | null;
  hoveredEquipmentId: string | null;
  // Shared by every time-series chart on the dashboard.
  timeRange: TimeRange | null;
  live: boolean;
  streamStatus: Record<string, "connecting" | "open" | "closed" | "error">;

  selectEquipment: (equipment: EquipmentNode | null, source?: string) => void;
  hoverEquipment: (equipmentId: string | null) => void;
  setTimeRange: (range: TimeRange | null, source?: string) => void;
  setLive: (live: boolean) => void;
  setStreamStatus: (
    channel: string,
    status: VizState["streamStatus"][string],
  ) => void;
  reset: () => void;
}

// Every action also emits on the EventBus, so a consumer can subscribe either way:
// a store selector for a value it renders, a listener for something it reacts to once.
export const useVizStore = create<VizState>()(
  subscribeWithSelector((set) => ({
    selectedEquipment: null,
    hoveredEquipmentId: null,
    timeRange: null,
    live: true,
    streamStatus: {},

    selectEquipment: (equipment, source) => {
      set({ selectedEquipment: equipment });
      vizEventBus.emit(VizEvent.EQUIPMENT_SELECT, { equipment, source });
    },
    hoverEquipment: (equipmentId) => set({ hoveredEquipmentId: equipmentId }),
    setTimeRange: (range, source) => {
      set({ timeRange: range });
      if (range)
        vizEventBus.emit(VizEvent.TIME_RANGE_CHANGE, { range, source });
    },
    setLive: (live) => set({ live }),
    setStreamStatus: (channel, status) => {
      set((state) => ({
        streamStatus: { ...state.streamStatus, [channel]: status },
      }));
      vizEventBus.emit(VizEvent.STREAM_STATUS, { channel, status });
    },
    reset: () =>
      set({
        selectedEquipment: null,
        hoveredEquipmentId: null,
        timeRange: null,
        live: true,
        streamStatus: {},
      }),
  })),
);

// Selecting the id alone, so a component that only needs it does not re-render when
// the rest of the equipment record changes.
export const useSelectedEquipmentId = (): string | null =>
  useVizStore((state) => state.selectedEquipment?.id ?? null);

// Subscribes to an EventBus event and unsubscribes on unmount.
export function useVizEvent<
  K extends keyof import("../core/EventBus/events").VizEventMap,
>(
  event: K,
  handler: (payload: import("../core/EventBus/events").VizEventMap[K]) => void,
  deps: unknown[] = [],
): void {
  useEffect(() => {
    return vizEventBus.on(event, handler);
    // The caller owns the dependency list; adding the handler here would resubscribe
    // on every render for an inline callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
