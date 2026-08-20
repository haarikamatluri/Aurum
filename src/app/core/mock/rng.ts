/**
 * Deterministic pseudo-random utilities for generating realistic, reproducible mock
 * market data. Seeded by string so the same symbol always produces the same "personality"
 * (baseline volatility, drift, etc.) across reloads within a session.
 */

export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — fast, deterministic, good-enough distribution for mock data. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seedStr: string): () => number {
  return mulberry32(hashSeed(seedStr));
}

/** Gaussian sample via Box-Muller, driven by a seeded uniform generator. */
export function gaussian(rand: () => number, mean = 0, stdDev = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randRange(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export interface WalkOptions {
  points: number;
  startValue: number;
  driftPct: number;
  volatilityPct: number;
  seed: string;
  intervalMs: number;
  endTime?: number;
}

/** Generates a random-walk time series (used for prices, indices, portfolio value history). */
export function generateWalk(opts: WalkOptions): { t: string; v: number }[] {
  const rand = seededRandom(opts.seed);
  const end = opts.endTime ?? Date.now();
  const series: { t: string; v: number }[] = [];
  let value = opts.startValue;
  for (let i = opts.points - 1; i >= 0; i--) {
    const time = end - i * opts.intervalMs;
    const shock = gaussian(rand, opts.driftPct / opts.points, opts.volatilityPct);
    value = Math.max(value * (1 + shock), 0.01);
    series.push({ t: new Date(time).toISOString(), v: Math.round(value * 100) / 100 });
  }
  return series;
}
