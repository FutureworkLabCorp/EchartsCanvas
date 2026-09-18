import type { SimNode } from "./types";

export interface QuadCell {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  // Leaf cells hold their nodes; internal cells hold four children, some of them null.
  nodes: SimNode[] | null;
  children: (QuadCell | null)[] | null;
  // Barnes-Hut accumulation: the summed charge of the subtree and where it acts from.
  charge: number;
  cx: number;
  cy: number;
}

// Coincident nodes can never be separated by subdividing, so depth is capped and such
// nodes share a leaf. The charge accumulation below still counts each of them.
const MAX_DEPTH = 20;

const makeCell = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): QuadCell => ({
  x0,
  y0,
  x1,
  y1,
  nodes: null,
  children: null,
  charge: 0,
  cx: 0,
  cy: 0,
});

const insert = (cell: QuadCell, node: SimNode, depth: number): void => {
  if (cell.children) {
    const midX = (cell.x0 + cell.x1) / 2;
    const midY = (cell.y0 + cell.y1) / 2;
    const index = (node.x >= midX ? 1 : 0) + (node.y >= midY ? 2 : 0);
    let child = cell.children[index];
    if (!child) {
      child = makeCell(
        index & 1 ? midX : cell.x0,
        index & 2 ? midY : cell.y0,
        index & 1 ? cell.x1 : midX,
        index & 2 ? cell.y1 : midY,
      );
      cell.children[index] = child;
    }
    insert(child, node, depth + 1);
    return;
  }

  if (!cell.nodes) {
    cell.nodes = [node];
    return;
  }

  if (depth >= MAX_DEPTH) {
    cell.nodes.push(node);
    return;
  }

  // The leaf is now holding two nodes, so it becomes internal and both are reinserted.
  const existing = cell.nodes;
  cell.nodes = null;
  cell.children = [null, null, null, null];
  for (const moved of existing) insert(cell, moved, depth + 1);
  insert(cell, node, depth + 1);
};

// Sums each subtree's charge and the point it acts from, weighted by magnitude so that
// a mix of attracting and repelling nodes still gives a sensible centre.
const accumulate = (
  cell: QuadCell,
  chargeOf: (node: SimNode) => number,
): void => {
  let charge = 0;
  let weight = 0;
  let cx = 0;
  let cy = 0;

  if (cell.nodes) {
    for (const node of cell.nodes) {
      const value = chargeOf(node);
      const magnitude = Math.abs(value);
      charge += value;
      weight += magnitude;
      cx += node.x * magnitude;
      cy += node.y * magnitude;
    }
  } else if (cell.children) {
    for (const child of cell.children) {
      if (!child) continue;
      accumulate(child, chargeOf);
      const magnitude = Math.abs(child.charge);
      charge += child.charge;
      weight += magnitude;
      cx += child.cx * magnitude;
      cy += child.cy * magnitude;
    }
  }

  cell.charge = charge;
  // A subtree whose charges cancel exactly has no centre to speak of; it also exerts no
  // net force, so the coordinates are never read.
  cell.cx = weight === 0 ? 0 : cx / weight;
  cell.cy = weight === 0 ? 0 : cy / weight;
};

// Builds a fresh tree per tick rather than maintaining one across ticks. Every node has
// moved by then, so an incremental tree would be rebuilt in all but name.
export const buildQuadtree = (
  nodes: readonly SimNode[],
  chargeOf: (node: SimNode) => number = () => 1,
): QuadCell | null => {
  if (nodes.length === 0) return null;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const node of nodes) {
    if (node.x < x0) x0 = node.x;
    if (node.y < y0) y0 = node.y;
    if (node.x > x1) x1 = node.x;
    if (node.y > y1) y1 = node.y;
  }

  // Squared and padded: the theta test compares cell width against distance, and a
  // degenerate extent would make every cell read as infinitely far away.
  const size = Math.max(x1 - x0, y1 - y0, 1) * 1.01;
  const root = makeCell(x0, y0, x0 + size, y0 + size);
  for (const node of nodes) insert(root, node, 0);
  accumulate(root, chargeOf);
  return root;
};

// Depth-first walk. Returning true from `visit` prunes that subtree, which is what lets
// Barnes-Hut stop at a cell it can treat as a single body.
export const visitQuadtree = (
  cell: QuadCell,
  visit: (cell: QuadCell) => boolean,
): void => {
  if (visit(cell)) return;
  if (!cell.children) return;
  for (const child of cell.children) {
    if (child) visitQuadtree(child, visit);
  }
};
