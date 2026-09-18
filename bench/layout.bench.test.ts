import { describe, it } from "vitest";
import {
  forceSimulation as d3Simulation,
  forceLink as d3Link,
  forceManyBody as d3ManyBody,
  forceCollide as d3Collide,
  forceCenter as d3Center,
  forceX as d3X,
  forceY as d3Y,
} from "d3-force-3d";
import {
  ForceSimulation,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forcePosition,
} from "../src/core/force";
import type { SimNode } from "../src/core/force";
import { createMockKnowledgeGraph } from "../src/mock/graph";

// Head-to-head against the layout engine react-force-graph-2d actually runs: force-graph
// depends on d3-force-3d, driven here in two dimensions.
//
// Both sides get the same graph, the same force parameters and the same cooling
// schedule, and both run until alpha falls under alphaMin, so neither is handed a tick
// budget that happens to suit it. Timing covers the settle only — no canvas, no React —
// because that is the part the two implementations actually dispute.

const LINK_DISTANCE = 130;
const CHARGE_STRENGTH = -700;
const COLLIDE_RADIUS = 80;
const GRAVITY = 0.1;
const ALPHA_MIN = 0.001;
const VELOCITY_DECAY = 0.4;

const SIZES: Array<[number, number]> = [
  [100, 80],
  [439, 352],
  [1000, 800],
  [2000, 1600],
  [4000, 3200],
];

const REPEATS = 3;

const runOurs = (nodeCount: number, edgeCount: number): number => {
  const graph = createMockKnowledgeGraph({ nodeCount, edgeCount });
  const nodes: SimNode[] = graph.nodes.map((node) => ({
    id: node.id,
    x: NaN,
    y: NaN,
    vx: 0,
    vy: 0,
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = graph.edges
    .map((edge) => ({
      source: byId.get(edge.source),
      target: byId.get(edge.target),
    }))
    .filter(
      (link): link is { source: SimNode; target: SimNode } =>
        !!link.source && !!link.target,
    );

  const started = performance.now();
  new ForceSimulation(nodes, {
    alphaMin: ALPHA_MIN,
    velocityDecay: VELOCITY_DECAY,
  })
    .addForce("link", forceLink(links, { distance: LINK_DISTANCE }))
    .addForce("charge", forceManyBody({ strength: CHARGE_STRENGTH }))
    .addForce("collide", forceCollide({ radius: COLLIDE_RADIUS, iterations: 2 }))
    .addForce("position", forcePosition({ strength: GRAVITY }))
    .addForce("center", forceCenter(0, 0))
    .settle(Number.MAX_SAFE_INTEGER);
  return performance.now() - started;
};

const runD3 = (nodeCount: number, edgeCount: number): number => {
  const graph = createMockKnowledgeGraph({ nodeCount, edgeCount });
  // d3 mutates the objects it is given and resolves link endpoints by id itself.
  const nodes = graph.nodes.map((node) => ({ id: node.id }));
  const links = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  const started = performance.now();
  const simulation = d3Simulation(nodes, 2)
    .alphaMin(ALPHA_MIN)
    .velocityDecay(VELOCITY_DECAY)
    .force(
      "link",
      d3Link(links)
        .id((node: { id: string }) => node.id)
        .distance(LINK_DISTANCE),
    )
    .force("charge", d3ManyBody().strength(CHARGE_STRENGTH))
    .force("collide", d3Collide(COLLIDE_RADIUS).iterations(2))
    // d3 has no single positioning force; forceX + forceY is the two-dimensional pair
    // matching what forcePosition does on our side.
    .force("x", d3X(0).strength(GRAVITY))
    .force("y", d3Y(0).strength(GRAVITY))
    .force("center", d3Center(0, 0))
    .stop();

  while (simulation.alpha() >= ALPHA_MIN) simulation.tick();
  return performance.now() - started;
};

const best = (run: () => number): number => {
  run();
  let fastest = Infinity;
  for (let i = 0; i < REPEATS; i += 1) fastest = Math.min(fastest, run());
  return fastest;
};

const pad = (value: string, width: number): string => value.padStart(width);

describe("layout settle", () => {
  it("compares ours against d3-force-3d", () => {
    const lines = [
      "",
      "Layout settle — ours vs d3-force-3d (the engine react-force-graph-2d runs)",
      `link=${LINK_DISTANCE} charge=${CHARGE_STRENGTH} collide=${COLLIDE_RADIUS} gravity=${GRAVITY} alphaMin=${ALPHA_MIN}`,
      `best of ${REPEATS}, after one warm-up`,
      "",
      "  nodes  edges      ours       d3     ratio",
      "  -----  -----  --------  -------  --------",
    ];

    for (const [nodeCount, edgeCount] of SIZES) {
      const ours = best(() => runOurs(nodeCount, edgeCount));
      const d3 = best(() => runD3(nodeCount, edgeCount));
      const ratio = ours / d3;
      lines.push(
        `  ${pad(String(nodeCount), 5)}  ${pad(String(edgeCount), 5)}  ` +
          `${pad(`${ours.toFixed(0)}ms`, 8)}  ${pad(`${d3.toFixed(0)}ms`, 7)}  ` +
          `${pad(`${ratio.toFixed(2)}x`, 8)}${ratio > 1 ? "  slower" : "  faster"}`,
      );
    }

    console.log(lines.join("\n"));
  });
});
