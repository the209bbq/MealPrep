/** Deterministic PRNG keyed on visit id (rotation spec §2.3). */

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createVisitRng(visitId: string): () => number {
  return mulberry32(hashStringToSeed(visitId));
}

export function uniformJitter(rng: () => number, span = 0.05): number {
  return (rng() * 2 - 1) * span;
}
