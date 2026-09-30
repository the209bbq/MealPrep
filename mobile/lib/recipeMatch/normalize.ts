import { INGREDIENT_SYNONYMS, STRIP_TOKENS } from './config';

export function normalizeIngredientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[demo sample\]/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('es') && token.length > 4) {
    const stem = token.slice(0, -2);
    if (stem.endsWith('sh') || stem.endsWith('ch') || stem.endsWith('ss') || stem.endsWith('x')) {
      return stem;
    }
  }
  if (token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenizeIngredientName(value: string): string[] {
  const normalized = normalizeIngredientName(value);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter((t) => t.length > 0 && !STRIP_TOKENS.has(t))
    .map(singularizeToken);
}

/** Expand name to canonical keys including synonym groups. */
export function expandSynonymKeys(name: string): string[] {
  const normalized = normalizeIngredientName(name);
  const keys = new Set<string>([normalized]);
  const tokens = tokenizeIngredientName(name).join(' ');
  if (tokens) keys.add(tokens);

  for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    const group = [canonical, ...synonyms].map(normalizeIngredientName);
    const tokenGroup = group.map((g) => tokenizeIngredientName(g).join(' '));
    const haystack = [normalized, tokens, ...group, ...tokenGroup];
    const hit = haystack.some(
      (candidate) =>
        candidate &&
        (candidate === normalized ||
          candidate === tokens ||
          normalized.includes(candidate) ||
          candidate.includes(normalized)),
    );
    if (hit) {
      keys.add(normalizeIngredientName(canonical));
      keys.add(tokenizeIngredientName(canonical).join(' '));
      for (const syn of synonyms) {
        keys.add(normalizeIngredientName(syn));
        keys.add(tokenizeIngredientName(syn).join(' '));
      }
    }
  }

  return [...keys].filter(Boolean);
}

export function fuzzyNameScore(a: string, b: string): number {
  const aNorm = normalizeIngredientName(a);
  const bNorm = normalizeIngredientName(b);
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;

  const aKeys = expandSynonymKeys(a);
  const bKeys = expandSynonymKeys(b);
  for (const ak of aKeys) {
    for (const bk of bKeys) {
      if (ak === bk) return 1;
      if (ak.includes(bk) || bk.includes(ak)) return 0.92;
    }
  }

  const aTokens = tokenizeIngredientName(a);
  const bTokens = tokenizeIngredientName(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const aSet = new Set(aTokens);
  const overlap = bTokens.filter((t) => aSet.has(t));
  if (overlap.length === 0) {
    const aJoined = aTokens.join(' ');
    const bJoined = bTokens.join(' ');
    if (aJoined.includes(bJoined) || bJoined.includes(aJoined)) return 0.88;
    return 0;
  }

  const unionSize = new Set([...aTokens, ...bTokens]).size;
  return Math.min(0.95, overlap.length / unionSize + overlap.length / Math.max(aTokens.length, bTokens.length) * 0.15);
}
