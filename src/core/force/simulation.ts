import type { Force, SimNode } from "./types";

export interface SimulationOptions {
  alpha?: number;
  alphaMin?: number;
  alphaDecay?: number;
  alphaTarget?: number;
  // Per-tick velocity damping. Without it the system oscillates instead of settling.
  velocityDecay?: number;
}

// Phyllotaxis: the golden angle spreads points evenly with no clustering and no random
// seed, so the same graph always starts from the same picture.
const INITIAL_RADIUS = 30;
const INITIAL_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const placeInitial = (nodes: readonly SimNode[]): void => {
  nodes.forEach((node, index) => {
    if (Number.isFinite(node.x) && Number.isFinite(node.y)) return;
    const radius = INITIAL_RADIUS * Math.sqrt(0.5 + index);
    const angle = index * INITIAL_ANGLE;
    node.x = radius * Math.cos(angle);
    node.y = radius * Math.sin(angle);
    node.vx = 0;
    node.vy = 0;
  });
};

export class ForceSimulation {
  private readonly forces = new Map<string, Force>();
  private nodes: SimNode[] = [];

  private alphaValue: number;
  private readonly alphaMin: number;
  private readonly alphaDecay: number;
  private alphaTargetValue: number;
  private readonly velocityDecay: number;

  constructor(nodes: SimNode[] = [], options: SimulationOptions = {}) {
    this.alphaValue = options.alpha ?? 1;
    this.alphaMin = options.alphaMin ?? 0.001;
    // The default cools from 1 to alphaMin over roughly 300 ticks.
    this.alphaDecay = options.alphaDecay ?? 1 - this.alphaMin ** (1 / 300);
    this.alphaTargetValue = options.alphaTarget ?? 0;
    this.velocityDecay = 1 - (options.velocityDecay ?? 0.4);
    this.setNodes(nodes);
  }

  setNodes(nodes: SimNode[]): this {
    this.nodes = nodes;
    placeInitial(this.nodes);
    for (const force of this.forces.values()) force.initialize?.(this.nodes);
    return this;
  }

  getNodes(): readonly SimNode[] {
    return this.nodes;
  }

  addForce(name: string, force: Force): this {
    this.forces.set(name, force);
    force.initialize?.(this.nodes);
    return this;
  }

  removeForce(name: string): this {
    this.forces.delete(name);
    return this;
  }

  get alpha(): number {
    return this.alphaValue;
  }

  // Raising the target keeps the simulation warm, which is how a drag stays responsive
  // instead of fighting an already-frozen layout.
  alphaTarget(target: number): this {
    this.alphaTargetValue = target;
    return this;
  }

  reheat(alpha = 1): this {
    this.alphaValue = alpha;
    return this;
  }

  get settled(): boolean {
    return this.alphaValue < this.alphaMin;
  }

  tick(iterations = 1): this {
    for (let i = 0; i < iterations; i += 1) {
      this.alphaValue +=
        (this.alphaTargetValue - this.alphaValue) * this.alphaDecay;

      for (const force of this.forces.values()) force(this.alphaValue);

      for (const node of this.nodes) {
        if (node.fx === undefined || node.fx === null) {
          node.vx *= this.velocityDecay;
          node.x += node.vx;
        } else {
          node.x = node.fx;
          node.vx = 0;
        }
        if (node.fy === undefined || node.fy === null) {
          node.vy *= this.velocityDecay;
          node.y += node.vy;
        } else {
          node.y = node.fy;
          node.vy = 0;
        }
      }
    }
    return this;
  }

  // Runs to rest without painting. Used to hand the first frame a settled layout rather
  // than letting the viewer watch it unfold.
  settle(maxTicks = 400): this {
    let ticks = 0;
    while (!this.settled && ticks < maxTicks) {
      this.tick();
      ticks += 1;
    }
    return this;
  }
}
