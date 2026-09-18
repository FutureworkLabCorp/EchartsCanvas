// d3-force-3d ships no types. Only the surface the benchmark drives is declared.
declare module "d3-force-3d" {
  interface Simulation {
    alphaMin(value: number): Simulation;
    velocityDecay(value: number): Simulation;
    force(name: string, force: unknown): Simulation;
    stop(): Simulation;
    tick(iterations?: number): Simulation;
    alpha(): number;
  }
  export function forceSimulation(
    nodes: unknown[],
    numDimensions?: number,
  ): Simulation;
  export function forceLink(links: unknown[]): {
    id(accessor: (node: never) => string): {
      distance(value: number): unknown;
    };
  };
  export function forceManyBody(): { strength(value: number): unknown };
  export function forceCollide(radius: number): {
    iterations(value: number): unknown;
  };
  export function forceCenter(x: number, y: number): unknown;
  export function forceX(x: number): { strength(value: number): unknown };
  export function forceY(y: number): { strength(value: number): unknown };
}
