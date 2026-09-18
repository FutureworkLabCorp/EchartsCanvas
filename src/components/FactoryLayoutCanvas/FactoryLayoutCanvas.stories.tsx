import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FactoryLayoutCanvas } from "./FactoryLayoutCanvas";
import { Panel, StatusBadge } from "../Panel/Panel";
import {
  createMockFactoryLayout,
  simulateStatusChanges,
} from "../../mock/factoryLayout";
import type { EquipmentNode, EquipmentStatus } from "../../types/domain";

const meta = {
  title: "02. 예시 컴포넌트/FactoryLayoutCanvas",
  component: FactoryLayoutCanvas,
  parameters: {
    docs: {
      description: {
        component:
          "`Canvas2DBase` 를 확장한 2D 공장 레이아웃 맵입니다. 설비 수가 늘어도 DOM 노드가 증가하지 않으며, 클릭·호버는 좌표 기반 Hit Detection 으로 처리합니다. 휠로 확대/축소, 드래그로 이동할 수 있습니다.",
      },
    },
  },
} satisfies Meta<typeof FactoryLayoutCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

const layout = createMockFactoryLayout();

export const 기본: Story = {
  args: { layout },
  render: (args) => (
    <Panel
      title="A동 1층 레이아웃"
      subtitle="휠: 확대/축소 · 드래그: 이동 · 클릭: 설비 선택"
      height={520}
    >
      <FactoryLayoutCanvas {...args} />
    </Panel>
  ),
};

/** 상태가 실시간으로 변하는 시나리오(경고 설비는 Pulse 애니메이션) */
export const 실시간_상태_변화: Story = {
  args: { layout },
  render: (args) => {
    const ids = useMemo(() => layout.equipments.map((item) => item.id), []);
    const [statuses, setStatuses] = useState<Record<string, EquipmentStatus>>(
      {},
    );

    useEffect(() => simulateStatusChanges(ids, setStatuses, 2500), [ids]);

    return (
      <Panel
        title="실시간 설비 상태"
        subtitle="2.5초마다 임의 설비 상태 변경"
        height={520}
      >
        <FactoryLayoutCanvas {...args} statusOverrides={statuses} />
      </Panel>
    );
  },
};

/** 설비 선택 → 상세 패널 연동(Hit Detection 검증) */
export const 설비_선택_연동: Story = {
  args: { layout },
  render: (args) => {
    const [selected, setSelected] = useState<EquipmentNode | null>(null);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 12 }}>
        <Panel title="레이아웃" height={520}>
          <FactoryLayoutCanvas
            {...args}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </Panel>
        <Panel title="설비 상세" height={520}>
          <div style={{ padding: 16, fontSize: 13, display: "grid", gap: 10 }}>
            {selected ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {selected.name}
                </div>
                <StatusBadge status={selected.status} />
                <div style={{ opacity: 0.7 }}>ID: {selected.id}</div>
                {Object.entries(selected.metrics ?? {}).map(([key, value]) => (
                  <div
                    key={key}
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ opacity: 0.7 }}>{key}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </>
            ) : (
              <span style={{ opacity: 0.6 }}>도면에서 설비를 클릭하세요.</span>
            )}
          </div>
        </Panel>
      </div>
    );
  },
};

/** 정적 도면 — rAF 루프를 끄고 필요할 때만 렌더 */
export const 정적_도면_ondemand: Story = {
  args: { layout, animate: false },
  render: (args) => (
    <Panel
      title="정적 도면 (on-demand 렌더)"
      subtitle="애니메이션 없음 · CPU 사용 최소"
      height={520}
    >
      <FactoryLayoutCanvas {...args} />
    </Panel>
  ),
};
