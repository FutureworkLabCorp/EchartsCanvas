// Seeded (mulberry32) so a story or a test renders the same data on every run, which
// Math.random cannot give.
export function createRandom(seed = 20260803): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller.
export function gaussian(random: () => number, mean = 0, stdDev = 1): number {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return (
    mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  );
}
