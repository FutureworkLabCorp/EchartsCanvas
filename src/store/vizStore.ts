import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useEffect } from "react";
import { vizEventBus } from "../core/EventBus/EventBus";
import { VizEvent } from "../core/EventBus/events";
import type { EquipmentNode, TimeRange } from "../types/domain";

export interface VizState {
  /** 현재 선택된 설비. 차트들이 이 값을 구독해 데이터셋을 선언적으로 교체한다. */
  selectedEquipment: EquipmentNode | null;
  hoveredEquipmentId: string | null;
  /** 이력 조회 구간(모든 시계열 차트가 공유) */
  timeRange: TimeRange | null;
  /** 실시간/일시정지 토글 */
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

/**
 * 대시보드 공통 상태.
 *
 * 액션이 상태 갱신과 동시에 EventBus 로 사건을 발행하므로,
 * 구독 방식(스토어 selector / 이벤트 리스너) 중 편한 쪽을 골라 쓸 수 있다.
 */
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

/** 선택된 설비 ID 만 필요한 컴포넌트용 셀렉터(불필요한 리렌더 방지) */
export const useSelectedEquipmentId = (): string | null =>
  useVizStore((state) => state.selectedEquipment?.id ?? null);

/**
 * EventBus 이벤트를 구독하는 훅. 언마운트 시 자동 해제된다.
 *
 * ```tsx
 * useVizEvent(VizEvent.EQUIPMENT_SELECT, ({ equipment }) => setTarget(equipment?.id));
 * ```
 */
export function useVizEvent<
  K extends keyof import("../core/EventBus/events").VizEventMap,
>(
  event: K,
  handler: (payload: import("../core/EventBus/events").VizEventMap[K]) => void,
  deps: unknown[] = [],
): void {
  useEffect(() => {
    return vizEventBus.on(event, handler);
    // 호출부가 의존성을 명시적으로 관리하도록 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
