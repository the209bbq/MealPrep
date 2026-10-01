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

function ingredientForms(name: string): string[] {
  const normalized = normalizeIngredientName(name);
  const tokenPhrase = tokenizeIngredientName(name).join(' ');
  return [normalized, tokenPhrase].filter(Boolean);
}

function tokensEqualSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((t) => bSet.has(t));
}

function nameBelongsToSynonymGroup(name: string, canonical: string, synonyms: string[]): boolean {
  const nameForms = ingredientForms(name);
  const members = [canonical, ...synonyms];

  for (const member of members) {
    const memberForms = ingredientForms(member);
    for (const nf of nameForms) {
      for (const mf of memberForms) {
        if (nf === mf) return true;
      }
    }
    const memberTokens = tokenizeIngredientName(member);
    for (const nf of nameForms) {
      const nameTokens = nf.includes(' ') ? nf.split(' ') : tokenizeIngredientName(nf);
      if (nameTokens.length > 0 && tokensEqualSet(nameTokens, memberTokens)) return true;
    }
  }

  return false;
}

/** Expand name to canonical keys including synonym groups (exact group membership only). */
export function expandSynonymKeys(name: string): string[] {
  const keys = new Set<string>();
  for (const form of ingredientForms(name)) keys.add(form);

  for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (!nameBelongsToSynonymGroup(name, canonical, synonyms)) continue;
    keys.add(normalizeIngredientName(canonical));
    keys.add(tokenizeIngredientName(canonical).join(' '));
    for (const syn of synonyms) {
      keys.add(normalizeIngredientName(syn));
      keys.add(tokenizeIngredientName(syn).join(' '));
    }
  }

  return [...keys].filter(Boolean);
}

function headToken(tokens: string[]): string | undefined {
  return tokens[tokens.length - 1];
}

function wholeTokenPresent(needle: string, tokens: string[]): boolean {
  return tokens.some((t) => t === needle);
}

/** True when shorter phrase is a strict subset of longer with compatible head nouns. */
function phraseSubsetScore(shortTokens: string[], longTokens: string[]): number {
  if (shortTokens.length === 0 || longTokens.length === 0) return 0;
  if (!shortTokens.every((t) => wholeTokenPresent(t, longTokens))) return 0;

  const shortHead = headToken(shortTokens)!;
  const longHead = headToken(longTokens)!;

  if (shortTokens.length === 1 && longTokens.length === 1) {
    return shortHead === longHead ? 0.92 : 0;
  }

  if (shortTokens.length === 1 && longTokens.length > 1) {
    const extras = longTokens.filter((t) => t !== shortTokens[0]);
    if (extras.length > 0) return 0;
  }

  if (shortTokens.length >= 2) {
    return shortHead === longHead ? 0.92 : 0;
  }

  // Single token on both sides (e.g. rice ↔ rice).
  return shortHead === longHead ? 0.92 : 0;
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
    }
  }

  const aTokens = tokenizeIngredientName(a);
  const bTokens = tokenizeIngredientName(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longer = aTokens.length <= bTokens.length ? bTokens : aTokens;
  const subsetScore = phraseSubsetScore(shorter, longer);
  if (subsetScore > 0) return subsetScore;

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  const overlap = aTokens.filter((t) => bSet.has(t));
  if (overlap.length === 0) return 0;

  const aHead = headToken(aTokens);
  const bHead = headToken(bTokens);
  if (!aHead || !bHead || aHead !== bHead) {
    return 0;
  }

  if (aTokens.length > 1 && bTokens.length > 1 && !tokensEqualSet(aTokens, bTokens)) {
    return 0;
  }

  const unionSize = new Set([...aTokens, ...bTokens]).size;
  return Math.min(
    0.88,
    overlap.length / unionSize + (overlap.length / Math.max(aTokens.length, bTokens.length)) * 0.12,
  );
}
