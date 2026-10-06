/** Beta(α, β) draw via Gamma ratio (rotation spec §2.3). */

function gammaSample(shape: number, rng: () => number): number {
  if (shape <= 0) return 0;
  if (shape < 1) {
    const u = rng();
    return gammaSample(shape + 1, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      const u1 = rng();
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function betaSample(alpha: number, beta: number, rng: () => number): number {
  const a = Math.max(0.001, alpha);
  const b = Math.max(0.001, beta);
  const ga = gammaSample(a, rng);
  const gb = gammaSample(b, rng);
  return ga / (ga + gb);
}

export function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}
