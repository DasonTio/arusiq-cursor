/**
 * Deterministic pseudo-randomness.
 *
 * `Math.random` would make the prototype a different prototype on every
 * reload: a screenshot could not be reproduced, a regression could not be
 * pinned and a test would have to assert ranges instead of values. Every
 * number here is a pure function of a seed string, so the dataset is stable
 * across runs, machines and agents.
 */

/** FNV-1a. Small, fast, and stable across engines — which is the requirement. */
export const hashSeed = (seed: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max], rounded to `decimals`. */
  float(min: number, max: number, decimals?: number): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
}

/** mulberry32 — 32 bits of state, uniform enough for plausible telemetry. */
export const createRng = (seed: string): Rng => {
  let state = hashSeed(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const float = (min: number, max: number, decimals = 1): number => {
    const raw = min + next() * (max - min);
    const f = 10 ** decimals;
    return Math.round(raw * f) / f;
  };
  return {
    next,
    float,
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (values) => values[Math.floor(next() * values.length)],
  };
};

/** Rounds to a fixed number of decimals without exposing float noise such as
 *  `1.4000000000000001` to a chart axis or a test assertion. */
export const round = (value: number, decimals = 1): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};
