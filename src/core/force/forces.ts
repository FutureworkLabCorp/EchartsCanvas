import { buildQuadtree, visitQuadtree } from "./quadtree";
import type { Force, SimLink, SimNode } from "./types";

// Two nodes at the same coordinates have no direction to push apart along, so a fixed
// tiny offset breaks the tie. Seeded rather than Math.random, so a layout reproduces.
const makeJiggle = (seed = 0x9e3779b9): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5) * 1e-6;
  };
};

export interface ManyBodyOptions {
  // Negative repels, which is what spreads a graph out. Positive would collapse it.
  strength?: number;
  // Barnes-Hut opening angle. Lower is more accurate and slower; 0 disables the
  // approximation entirely and makes the force O(n^2).
  theta?: number;
  distanceMin?: number;
  distanceMax?: number;
}

export const forceManyBody = ({
  strength = -30,
  theta = 0.9,
  distanceMin = 1,
  distanceMax = Infinity,
}: ManyBodyOptions = {}): Force => {
  let nodes: readonly SimNode[] = [];
  const jiggle = makeJiggle();
  const theta2 = theta * theta;
  const distanceMin2 = distanceMin * distanceMin;
  const distanceMax2 = distanceMax * distanceMax;

  const force = (alpha: number): void => {
    const root = buildQuadtree(nodes, () => strength);
    if (!root) return;

    for (const node of nodes) {
      visitQuadtree(root, (cell) => {
        if (cell.charge === 0) return true;

        let dx = cell.cx - node.x;
        let dy = cell.cy - node.y;
        const width = cell.x1 - cell.x0;
        let distance2 = dx * dx + dy * dy;

        // Far enough that the whole subtree can act as one body at its centre.
        if ((width * width) / theta2 < distance2) {
          if (distance2 < distanceMax2) {
            if (dx === 0) {
              dx = jiggle();
              distance2 += dx * dx;
            }
            if (dy === 0) {
              dy = jiggle();
              distance2 += dy * dy;
            }
            if (distance2 < distanceMin2) {
              distance2 = Math.sqrt(distanceMin2 * distance2);
            }
            const w = (cell.charge * alpha) / distance2;
            node.vx += dx * w;
            node.vy += dy * w;
          }
          return true;
        }

        // Too close to approximate, and still internal, so keep descending.
        if (cell.children) return false;
        if (distance2 >= distanceMax2) return true;

        for (const other of cell.nodes ?? []) {
          if (other === node) continue;
          let ox = other.x - node.x;
          let oy = other.y - node.y;
          let d2 = ox * ox + oy * oy;
          if (ox === 0) {
            ox = jiggle();
            d2 += ox * ox;
          }
          if (oy === 0) {
            oy = jiggle();
            d2 += oy * oy;
          }
          if (d2 < distanceMin2) d2 = Math.sqrt(distanceMin2 * d2);
          const w = (strength * alpha) / d2;
          node.vx += ox * w;
          node.vy += oy * w;
        }
        return true;
      });
    }
  };

  force.initialize = (next: readonly SimNode[]): void => {
    nodes = next;
  };

  return force;
};

export interface LinkOptions<TNode extends SimNode = SimNode> {
  distance?: number | ((link: SimLink<TNode>) => number);
  // Defaults to 1 / min(degree(source), degree(target)): a link touching a hub pulls
  // less, so one heavily connected node does not drag the whole graph onto itself.
  strength?: number | ((link: SimLink<TNode>) => number);
  iterations?: number;
}

export const forceLink = <TNode extends SimNode>(
  links: readonly SimLink<TNode>[],
  { distance = 60, strength, iterations = 1 }: LinkOptions<TNode> = {},
): Force => {
  const jiggle = makeJiggle(0x85ebca6b);
  let distances: number[] = [];
  let strengths: number[] = [];
  let biases: number[] = [];

  const resolve = <T>(
    value: T | ((link: SimLink<TNode>) => T),
    link: SimLink<TNode>,
  ): T =>
    typeof value === "function"
      ? (value as (l: SimLink<TNode>) => T)(link)
      : value;

  const force = (alpha: number): void => {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let i = 0; i < links.length; i += 1) {
        const link = links[i];
        if (!link) continue;
        const { source, target } = link;

        // Velocities are included so that within one tick the later links see the
        // displacement the earlier ones just asked for, which is what makes a few
        // iterations converge instead of fighting each other.
        let dx = target.x + target.vx - source.x - source.vx;
        let dy = target.y + target.vy - source.y - source.vy;
        if (dx === 0) dx = jiggle();
        if (dy === 0) dy = jiggle();

        const length = Math.sqrt(dx * dx + dy * dy);
        const rest = distances[i] ?? 0;
        const k = ((length - rest) / length) * alpha * (strengths[i] ?? 0);
        dx *= k;
        dy *= k;

        const bias = biases[i] ?? 0.5;
        target.vx -= dx * bias;
        target.vy -= dy * bias;
        source.vx += dx * (1 - bias);
        source.vy += dy * (1 - bias);
      }
    }
  };

  force.initialize = (): void => {
    const degree = new Map<string, number>();
    for (const link of links) {
      degree.set(link.source.id, (degree.get(link.source.id) ?? 0) + 1);
      degree.set(link.target.id, (degree.get(link.target.id) ?? 0) + 1);
    }

    distances = links.map((link) => resolve(distance, link));
    biases = links.map((link) => {
      const source = degree.get(link.source.id) ?? 1;
      const target = degree.get(link.target.id) ?? 1;
      return source / (source + target);
    });
    strengths = links.map((link) => {
      if (strength !== undefined) return resolve(strength, link);
      const source = degree.get(link.source.id) ?? 1;
      const target = degree.get(link.target.id) ?? 1;
      return 1 / Math.min(source, target);
    });
  };

  return force;
};

export interface CollideOptions<TNode extends SimNode = SimNode> {
  // A per-node accessor lets a caller size the radius from whatever it renders, which
  // is why this is generic over the node type rather than fixed to SimNode.
  radius: number | ((node: TNode) => number);
  strength?: number;
  iterations?: number;
}

// A uniform grid rather than the quadtree the repulsion uses. Collision only ever looks
// at neighbours within one maximum radius, which a grid answers in constant time, and
// the cells stay well populated at the densities this renders.
export const forceCollide = <TNode extends SimNode>({
  radius,
  strength = 0.7,
  iterations = 1,
}: CollideOptions<TNode>): Force => {
  const jiggle = makeJiggle(0xc2b2ae35);
  let nodes: readonly TNode[] = [];
  let radii: number[] = [];
  let cellSize = 1;

  const force = (): void => {
    if (nodes.length === 0) return;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const buckets = new Map<string, number[]>();
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node) continue;
        const key = `${Math.floor((node.x + node.vx) / cellSize)}|${Math.floor((node.y + node.vy) / cellSize)}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(i);
        else buckets.set(key, [i]);
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node) continue;
        const ri = radii[i] ?? 0;
        const gx = Math.floor((node.x + node.vx) / cellSize);
        const gy = Math.floor((node.y + node.vy) / cellSize);

        for (let ox = -1; ox <= 1; ox += 1) {
          for (let oy = -1; oy <= 1; oy += 1) {
            for (const j of buckets.get(`${gx + ox}|${gy + oy}`) ?? []) {
              // Each pair is resolved once, by the lower index.
              if (j <= i) continue;
              const other = nodes[j];
              if (!other) continue;

              const rj = radii[j] ?? 0;
              const overlapAt = ri + rj;
              let dx = node.x + node.vx - other.x - other.vx;
              let dy = node.y + node.vy - other.y - other.vy;
              let d2 = dx * dx + dy * dy;
              if (d2 >= overlapAt * overlapAt) continue;

              if (dx === 0) {
                dx = jiggle();
                d2 += dx * dx;
              }
              if (dy === 0) {
                dy = jiggle();
                d2 += dy * dy;
              }
              const d = Math.sqrt(d2);
              // Split by area, so a large node yields less ground than a small one.
              const push = ((overlapAt - d) / d) * strength;
              const shareOther = (rj * rj) / (ri * ri + rj * rj);
              node.vx += dx * push * shareOther;
              node.vy += dy * push * shareOther;
              other.vx -= dx * push * (1 - shareOther);
              other.vy -= dy * push * (1 - shareOther);
            }
          }
        }
      }
    }
  };

  force.initialize = (next: readonly SimNode[]): void => {
    // The simulation only ever hands back the nodes this force was registered with.
    nodes = next as readonly TNode[];
    radii = nodes.map((node) =>
      typeof radius === "function" ? radius(node) : radius,
    );
    // One cell per largest diameter, so an overlapping pair is always within the 3x3
    // neighbourhood scanned above.
    cellSize = Math.max(1, 2 * Math.max(1, ...radii));
  };

  return force;
};

export interface PositionOptions {
  x?: number;
  y?: number;
  strength?: number;
}

// Pulls every node towards a point. Without it a node with no links feels only repulsion
// and drifts out indefinitely, which spreads the layout until the fit-to-view scale drops
// below the point where labels can be drawn at all.
export const forcePosition = ({
  x = 0,
  y = 0,
  strength = 0.06,
}: PositionOptions = {}): Force => {
  let nodes: readonly SimNode[] = [];

  const force = (alpha: number): void => {
    const k = strength * alpha;
    for (const node of nodes) {
      node.vx += (x - node.x) * k;
      node.vy += (y - node.y) * k;
    }
  };

  force.initialize = (next: readonly SimNode[]): void => {
    nodes = next;
  };

  return force;
};

// Recentres by translation rather than by pulling each node, so it never distorts the
// layout the other forces produced.
export const forceCenter = (x = 0, y = 0): Force => {
  let nodes: readonly SimNode[] = [];

  const force = (): void => {
    if (nodes.length === 0) return;
    let sx = 0;
    let sy = 0;
    for (const node of nodes) {
      sx += node.x;
      sy += node.y;
    }
    const dx = sx / nodes.length - x;
    const dy = sy / nodes.length - y;
    for (const node of nodes) {
      node.x -= dx;
      node.y -= dy;
    }
  };

  force.initialize = (next: readonly SimNode[]): void => {
    nodes = next;
  };

  return force;
};
