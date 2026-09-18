import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RelationGraphCanvas } from "./RelationGraphCanvas";
import { createMockKnowledgeGraph, koGraphTypeStyles } from "../../mock/graph";
import { Panel } from "../Panel/Panel";
import type { GraphNode } from "../../types/domain";

const graph = createMockKnowledgeGraph();

const meta = {
  title: "04. 관계 그래프/RelationGraphCanvas",
  component: RelationGraphCanvas,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RelationGraphCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

const Legend = () => (
  <div
    style={{
      display: "flex",
      gap: 18,
      alignItems: "center",
      fontSize: 12,
      padding: "10px 4px 0",
    }}
  >
    {Object.entries(koGraphTypeStyles).map(([key, style]) => (
      <span
        key={key}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: style.color,
          }}
        />
        {style.label}
      </span>
    ))}
  </div>
);

// The whole graph at once: 439 nodes and 352 edges, laid out by the bundled force
// simulation with no external graph library.
export const Explorer: Story = {
  args: { data: graph, typeStyles: koGraphTypeStyles },
  render: (args) => {
    const [selected, setSelected] = useState<GraphNode | null>(null);
    return (
      <div
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      >
        <Panel
          title="지식그래프"
          subtitle={`노드 ${args.data.nodes.length} · 엣지 ${args.data.edges.length}`}
          height="100%"
          extra={
            selected ? (
              <span style={{ fontSize: 12 }}>
                {koGraphTypeStyles[selected.type]?.label} · {selected.label}
              </span>
            ) : undefined
          }
        >
          <RelationGraphCanvas
            {...args}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            ariaLabel="지식그래프 관계도"
          />
        </Panel>
        <Legend />
      </div>
    );
  },
};

// Neighbour focus off, so every node keeps full contrast when one is selected.
export const NoFocusDimming: Story = {
  args: {
    data: graph,
    typeStyles: koGraphTypeStyles,
    focusNeighbours: false,
  },
  render: (args) => {
    const [selected, setSelected] = useState<GraphNode | null>(null);
    return (
      <div style={{ height: "100vh" }}>
        <Panel title="포커스 디밍 없음" height="100%">
          <RelationGraphCanvas
            {...args}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </Panel>
      </div>
    );
  },
};

// Ten times the nodes of the screenshot, to show where the layout cost actually lands.
export const LargeGraph: Story = {
  args: { data: graph, typeStyles: koGraphTypeStyles },
  render: () => {
    const large = useMemo(
      () => createMockKnowledgeGraph({ nodeCount: 4000, edgeCount: 3200 }),
      [],
    );
    return (
      <div style={{ height: "100vh" }}>
        <Panel
          title="대용량"
          subtitle={`노드 ${large.nodes.length} · 엣지 ${large.edges.length}`}
          height="100%"
        >
          <RelationGraphCanvas
            data={large}
            typeStyles={koGraphTypeStyles}
            linkDistance={90}
            chargeStrength={-400}
          />
        </Panel>
      </div>
    );
  },
};
