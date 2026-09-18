import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  forceSimulation as d3dSimulation,
  forceLink as d3dLink,
  forceManyBody as d3dManyBody,
  forceCollide as d3dCollide,
  forceCenter as d3dCenter,
  forceX as d3dX,
  forceY as d3dY,
} from "d3-force-3d";
import {
  forceSimulation as d2Simulation,
  forceLink as d2Link,
  forceManyBody as d2ManyBody,
  forceCollide as d2Collide,
  forceCenter as d2Center,
  forceX as d2X,
  forceY as d2Y,
  type SimulationNodeDatum,
} from "d3-force";
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

// Three layout engines on the same graph, the same force parameters and the same cooling
// schedule, each run until alpha falls under alphaMin so none is handed a tick budget
// that happens to suit it.
//
// d3-force-3d is what react-force-graph-2d actually runs, through force-graph. Plain
// d3-force is here because that fork is generalized to N dimensions, and without the 2D
// original as a third reading there is no telling whether a difference is against d3's
// algorithm or only against the cost of that generalization.
//
// Timing covers the settle alone — no canvas, no React — since that is the part the
// implementations dispute. Ticks and spread are recorded beside it: finishing sooner by
// running fewer steps, or by settling into a differently sized layout, is not a win.

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

interface Run {
  ms: number;
  ticks: number;
  spread: number;
}

const spreadOf = (
  nodes: ReadonlyArray<{ x?: number | undefined; y?: number | undefined }>,
): number =>
  Math.max(...nodes.map((node) => Math.hypot(node.x ?? 0, node.y ?? 0)));

const runOurs = (nodeCount: number, edgeCount: number): Run => {
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
  const simulation = new ForceSimulation(nodes, {
    alphaMin: ALPHA_MIN,
    velocityDecay: VELOCITY_DECAY,
  })
    .addForce("link", forceLink(links, { distance: LINK_DISTANCE }))
    .addForce("charge", forceManyBody({ strength: CHARGE_STRENGTH }))
    .addForce(
      "collide",
      forceCollide({ radius: COLLIDE_RADIUS, iterations: 2 }),
    )
    .addForce("position", forcePosition({ strength: GRAVITY }))
    .addForce("center", forceCenter(0, 0));

  let ticks = 0;
  while (!simulation.settled) {
    simulation.tick();
    ticks += 1;
  }
  return { ms: performance.now() - started, ticks, spread: spreadOf(nodes) };
};

const runD3Force3d = (nodeCount: number, edgeCount: number): Run => {
  const graph = createMockKnowledgeGraph({ nodeCount, edgeCount });
  // d3 mutates the objects it is given and resolves link endpoints by id itself.
  const nodes = graph.nodes.map((node) => ({ id: node.id }));
  const links = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  const started = performance.now();
  const simulation = d3dSimulation(nodes, 2)
    .alphaMin(ALPHA_MIN)
    .velocityDecay(VELOCITY_DECAY)
    .force(
      "link",
      d3dLink(links)
        .id((node: { id: string }) => node.id)
        .distance(LINK_DISTANCE),
    )
    .force("charge", d3dManyBody().strength(CHARGE_STRENGTH))
    .force("collide", d3dCollide(COLLIDE_RADIUS).iterations(2))
    // d3 has no single positioning force; forceX + forceY is the two-dimensional pair
    // matching what forcePosition does on our side.
    .force("x", d3dX(0).strength(GRAVITY))
    .force("y", d3dY(0).strength(GRAVITY))
    .force("center", d3dCenter(0, 0))
    .stop();

  let ticks = 0;
  while (simulation.alpha() >= ALPHA_MIN) {
    simulation.tick();
    ticks += 1;
  }
  return {
    ms: performance.now() - started,
    ticks,
    spread: spreadOf(nodes as Array<{ x?: number; y?: number }>),
  };
};

interface D2Node extends SimulationNodeDatum {
  id: string;
}

const runD3Force = (nodeCount: number, edgeCount: number): Run => {
  const graph = createMockKnowledgeGraph({ nodeCount, edgeCount });
  const nodes: D2Node[] = graph.nodes.map((node) => ({ id: node.id }));
  const links = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  const started = performance.now();
  const simulation = d2Simulation<D2Node>(nodes)
    .alphaMin(ALPHA_MIN)
    .velocityDecay(VELOCITY_DECAY)
    .force(
      "link",
      d2Link<D2Node, { source: string; target: string }>(links)
        .id((node) => node.id)
        .distance(LINK_DISTANCE),
    )
    .force("charge", d2ManyBody<D2Node>().strength(CHARGE_STRENGTH))
    .force("collide", d2Collide<D2Node>(COLLIDE_RADIUS).iterations(2))
    .force("x", d2X<D2Node>(0).strength(GRAVITY))
    .force("y", d2Y<D2Node>(0).strength(GRAVITY))
    .force("center", d2Center<D2Node>(0, 0))
    .stop();

  let ticks = 0;
  while (simulation.alpha() >= ALPHA_MIN) {
    simulation.tick();
    ticks += 1;
  }
  return { ms: performance.now() - started, ticks, spread: spreadOf(nodes) };
};

const best = (run: () => Run): Run => {
  run();
  let fastest: Run = { ms: Infinity, ticks: 0, spread: 0 };
  for (let i = 0; i < REPEATS; i += 1) {
    const result = run();
    if (result.ms < fastest.ms) fastest = result;
  }
  return fastest;
};

const pad = (value: string, width: number): string => value.padStart(width);
const kilo = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);

describe("layout settle", () => {
  it("compares ours against d3-force-3d and d3-force", () => {
    const lines = [
      "",
      "Layout settle — ours vs d3-force-3d (what react-force-graph-2d runs) vs d3-force",
      `link=${LINK_DISTANCE} charge=${CHARGE_STRENGTH} collide=${COLLIDE_RADIUS} gravity=${GRAVITY} alphaMin=${ALPHA_MIN} velocityDecay=${VELOCITY_DECAY}`,
      `best of ${REPEATS} after one warm-up. ticks and spread guard against winning by doing less.`,
      "",
      "  nodes      ours    d3-3d      d3f  ours/3d  ours/d3f  ticks o/3d/d3f  spread o/3d/d3f",
      "  -----  --------  -------  -------  -------  --------  --------------  ---------------",
    ];

    for (const [nodeCount, edgeCount] of SIZES) {
      const ours = best(() => runOurs(nodeCount, edgeCount));
      const d3d = best(() => runD3Force3d(nodeCount, edgeCount));
      const d2f = best(() => runD3Force(nodeCount, edgeCount));

      lines.push(
        `  ${pad(String(nodeCount), 5)}  ` +
          `${pad(`${ours.ms.toFixed(0)}ms`, 8)}  ` +
          `${pad(`${d3d.ms.toFixed(0)}ms`, 7)}  ` +
          `${pad(`${d2f.ms.toFixed(0)}ms`, 7)}  ` +
          `${pad(`${(ours.ms / d3d.ms).toFixed(2)}x`, 7)}  ` +
          `${pad(`${(ours.ms / d2f.ms).toFixed(2)}x`, 8)}  ` +
          `${pad(`${ours.ticks}/${d3d.ticks}/${d2f.ticks}`, 14)}  ` +
          `${kilo(ours.spread)}/${kilo(d3d.spread)}/${kilo(d2f.spread)}`,
      );
    }

    const report = lines.join("\n");
    // Written as well as logged: vitest captures console output, and a measurement is
    // worth keeping anyway — a later claim has to cite the run it came from.
    const out = "bench/results/layout.md";
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `# Layout settle benchmark\n\nRun ${new Date().toISOString()} on node ${process.version}.\n\n\`\`\`${report}\n\`\`\`\n`,
    );
    console.log(report);
  });
});
