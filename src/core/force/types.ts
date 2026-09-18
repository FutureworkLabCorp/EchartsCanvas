export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Pinned position. While set, the simulation writes x/y from it and zeroes velocity,
  // which is how a dragged node stays under the cursor.
  fx?: number | null;
  fy?: number | null;
}

// Links arrive referencing node ids and are resolved to the node objects once, before
// any force initializes, so a force never looks an id up per tick.
export interface SimLink<TNode extends SimNode = SimNode> {
  source: TNode;
  target: TNode;
}

// `initialize` runs whenever the node set changes, letting a force cache per-node work
// (link counts, strengths) instead of recomputing it on every tick.
export interface Force {
  (alpha: number): void;
  initialize?: (nodes: readonly SimNode[]) => void;
}
