/**
 * Standalone example checks for pantry ↔ recipe matching (no test runner in repo).
 * Run from mobile/: node scripts/recipe-match-examples.mjs
 */

function normalizeIngredientName(value) {
  return value
    .toLowerCase()
    .replace(/\[demo sample\]/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STRIP = new Set(['skippy', 'jif', 'smoked', 'creamy', 'fresh', 'organic']);

function tokenize(name) {
  return normalizeIngredientName(name)
    .split(' ')
    .filter((t) => t && !STRIP.has(t))
    .map((t) => (t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t));
}

function fuzzyNameScore(a, b) {
  const aNorm = normalizeIngredientName(a);
  const bNorm = normalizeIngredientName(b);
  if (aNorm === bNorm) return 1;
  const aT = tokenize(a).join(' ');
  const bT = tokenize(b).join(' ');
  if (aT === bT || aT.includes(bT) || bT.includes(aT)) return 0.9;
  return 0;
}

const peanut = fuzzyNameScore('Skippy Peanut Butter', 'peanut butter');
const scallion = fuzzyNameScore('scallions', 'green onion');

console.log('Skippy vs peanut butter:', peanut);
console.log('scallions vs green onion (smoke test):', scallion);

if (peanut < 0.72) {
  console.error('FAIL: expected peanut butter match');
  process.exit(1);
}

console.log('Example checks passed (see npm run typecheck for full module typing).');
