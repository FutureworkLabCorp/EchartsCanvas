import { describe, expect, it } from "vitest";
import { ForceSimulation, placeInitial } from "./simulation";
import { forceCenter, forceCollide, forceLink, forceManyBody } from "./forces";
import { buildQuadtree, visitQuadtree } from "./quadtree";
import type { SimLink, SimNode } from "./types";

const makeNodes = (count: number): SimNode[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    x: NaN,
    y: NaN,
    vx: 0,
    vy: 0,
  }));

const linkByIndex = (nodes: SimNode[], pairs: Array<[number, number]>) =>
  pairs.map(([a, b]) => ({
    source: nodes[a] as SimNode,
    target: nodes[b] as SimNode,
  })) satisfies SimLink[];

const distance = (a: SimNode, b: SimNode): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("quadtree", () => {
  it("sums the charge of every inserted node into the root", () => {
    const nodes = makeNodes(50);
    placeInitial(nodes);
    const root = buildQuadtree(nodes, () => -30);
    expect(root?.charge).toBeCloseTo(-30 * 50, 6);
  });

  it("keeps coincident nodes in one leaf instead of recursing forever", () => {
    const nodes: SimNode[] = Array.from({ length: 8 }, (_, i) => ({
      id: `n${i}`,
      x: 5,
      y: 5,
      vx: 0,
      vy: 0,
    }));
    const root = buildQuadtree(nodes);
    expect(root).not.toBeNull();

    let leafCount = 0;
    visitQuadtree(root as NonNullable<typeof root>, (cell) => {
      if (cell.nodes) leafCount += cell.nodes.length;
      return false;
    });
    expect(leafCount).toBe(8);
  });

  it("prunes a subtree when the visitor returns true", () => {
    const nodes = makeNodes(40);
    placeInitial(nodes);
    const root = buildQuadtree(nodes);
    let visited = 0;
    visitQuadtree(root as NonNullable<typeof root>, () => {
      visited += 1;
      return true;
    });
    expect(visited).toBe(1);
  });
});

describe("placeInitial", () => {
  it("is deterministic and never stacks two nodes on one point", () => {
    const first = makeNodes(200);
    const second = makeNodes(200);
    placeInitial(first);
    placeInitial(second);

    expect(first.map((n) => [n.x, n.y])).toEqual(second.map((n) => [n.x, n.y]));
    const points = new Set(first.map((n) => `${n.x}|${n.y}`));
    expect(points.size).toBe(200);
  });

  it("leaves a node that already has coordinates alone", () => {
    const nodes: SimNode[] = [{ id: "a", x: 12, y: -4, vx: 0, vy: 0 }];
    placeInitial(nodes);
    expect(nodes[0]).toMatchObject({ x: 12, y: -4 });
  });
});

describe("forceManyBody", () => {
  it("pushes two nodes apart", () => {
    const nodes: SimNode[] = [
      { id: "a", x: -1, y: 0, vx: 0, vy: 0 },
      { id: "b", x: 1, y: 0, vx: 0, vy: 0 },
    ];
    const sim = new ForceSimulation(nodes).addForce(
      "charge",
      forceManyBody({ strength: -100 }),
    );
    const before = distance(nodes[0] as SimNode, nodes[1] as SimNode);
    sim.tick(20);
    expect(distance(nodes[0] as SimNode, nodes[1] as SimNode)).toBeGreaterThan(
      before,
    );
  });

  it("approximates the exact n-body result within a few percent", () => {
    const exact = makeNodes(120);
    const approx = makeNodes(120);
    placeInitial(exact);
    placeInitial(approx);

    // theta 0 forces every cell to be opened, which is the O(n^2) exact calculation.
    new ForceSimulation(exact)
      .addForce("charge", forceManyBody({ strength: -40, theta: 0 }))
      .tick(30);
    new ForceSimulation(approx)
      .addForce("charge", forceManyBody({ strength: -40, theta: 0.9 }))
      .tick(30);

    const spread = (nodes: SimNode[]) =>
      Math.max(...nodes.map((n) => Math.hypot(n.x, n.y)));
    const error = Math.abs(spread(approx) - spread(exact)) / spread(exact);
    expect(error).toBeLessThan(0.05);
  });
});

describe("forceLink", () => {
  it("pulls a stretched link back towards its rest distance", () => {
    const nodes: SimNode[] = [
      { id: "a", x: -400, y: 0, vx: 0, vy: 0 },
      { id: "b", x: 400, y: 0, vx: 0, vy: 0 },
    ];
    const links = linkByIndex(nodes, [[0, 1]]);
    const sim = new ForceSimulation(nodes).addForce(
      "link",
      forceLink(links, { distance: 60, strength: 1 }),
    );
    sim.tick(200);
    expect(distance(nodes[0] as SimNode, nodes[1] as SimNode)).toBeLessThan(
      400,
    );
  });
});

describe("forceCollide", () => {
  it("separates overlapping nodes to at least their combined radius", () => {
    const nodes: SimNode[] = [
      { id: "a", x: 0, y: 0, vx: 0, vy: 0 },
      { id: "b", x: 4, y: 0, vx: 0, vy: 0 },
    ];
    const sim = new ForceSimulation(nodes).addForce(
      "collide",
      forceCollide({ radius: 20, strength: 1, iterations: 3 }),
    );
    sim.tick(80);
    expect(distance(nodes[0] as SimNode, nodes[1] as SimNode)).toBeGreaterThan(
      30,
    );
  });
});

describe("forceCenter", () => {
  it("moves the centroid onto the requested point", () => {
    const nodes: SimNode[] = [
      { id: "a", x: 100, y: 100, vx: 0, vy: 0 },
      { id: "b", x: 300, y: 300, vx: 0, vy: 0 },
    ];
    new ForceSimulation(nodes).addForce("center", forceCenter(0, 0)).tick(1);
    const cx = (nodes[0]!.x + nodes[1]!.x) / 2;
    const cy = (nodes[0]!.y + nodes[1]!.y) / 2;
    expect(cx).toBeCloseTo(0, 6);
    expect(cy).toBeCloseTo(0, 6);
  });
});

describe("ForceSimulation", () => {
  it("cools to rest and reports it", () => {
    const sim = new ForceSimulation(makeNodes(30)).addForce(
      "charge",
      forceManyBody(),
    );
    expect(sim.settled).toBe(false);
    sim.settle();
    expect(sim.settled).toBe(true);
    expect(sim.alpha).toBeLessThan(0.001);
  });

  it("holds a pinned node in place and clears its velocity", () => {
    const nodes = makeNodes(20);
    placeInitial(nodes);
    const pinned = nodes[0] as SimNode;
    pinned.fx = 0;
    pinned.fy = 0;

    new ForceSimulation(nodes)
      .addForce("charge", forceManyBody({ strength: -200 }))
      .tick(50);

    expect(pinned.x).toBe(0);
    expect(pinned.y).toBe(0);
    expect(pinned.vx).toBe(0);
    expect(pinned.vy).toBe(0);
  });

  it("settles a 439-node graph to finite coordinates", () => {
    const nodes = makeNodes(439);
    const pairs: Array<[number, number]> = Array.from(
      { length: 352 },
      (_, i) => [i % 439, (i * 7 + 13) % 439],
    );
    const links = linkByIndex(nodes, pairs);

    const sim = new ForceSimulation(nodes)
      .addForce("link", forceLink(links, { distance: 80 }))
      .addForce("charge", forceManyBody({ strength: -220 }))
      .addForce("collide", forceCollide({ radius: 40 }))
      .addForce("center", forceCenter(0, 0));

    sim.settle();

    expect(sim.settled).toBe(true);
    expect(
      nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
    ).toBe(true);
    // A collapsed or exploded layout is the usual failure; neither is true here.
    const spread = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y)));
    expect(spread).toBeGreaterThan(100);
    expect(spread).toBeLessThan(100_000);
  });

  it("produces the same layout twice for the same input", () => {
    const run = () => {
      const nodes = makeNodes(80);
      const links = linkByIndex(
        nodes,
        Array.from({ length: 60 }, (_, i) => [i % 80, (i * 3 + 5) % 80]),
      );
      new ForceSimulation(nodes)
        .addForce("link", forceLink(links))
        .addForce("charge", forceManyBody())
        .addForce("collide", forceCollide({ radius: 30 }))
        .settle();
      return nodes.map((n) => `${n.x.toFixed(6)},${n.y.toFixed(6)}`);
    };
    expect(run()).toEqual(run());
  });
});
