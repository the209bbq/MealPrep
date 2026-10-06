import {
  PANTRY_SCAN_PHRASE_SYNONYMS,
  PANTRY_SCAN_STRIP_BRANDS,
} from '../../config/pantryScanNormalize';
import {
  FUZZY_MATCH_THRESHOLD,
  INGREDIENT_CATEGORY_GROUPS,
  INGREDIENT_CUT_OR_FORM_MODIFIERS,
  INGREDIENT_SUBSTITUTE_MATCH_SCORE,
  INGREDIENT_SYNONYMS,
  INGREDIENT_STRIP_TOKENS,
} from '../../config/recipeMatchingConfig';

const CUT_MODIFIERS = new Set<string>(INGREDIENT_CUT_OR_FORM_MODIFIERS);

/** Variety words that refine a generic ingredient (jasmine rice) but are not a different product. */
const VARIETY_MODIFIERS = new Set(['jasmine', 'basmati', 'brown', 'wild', 'cauliflower', 'white', 'yellow', 'red']);

const STRIP_TOKENS = new Set<string>(INGREDIENT_STRIP_TOKENS);

const QUANTITY_PATTERNS: RegExp[] = [
  /\b\d+(\.\d+)?\s*(%|percent)\b/gi,
  /\b\d+(\.\d+)?%/gi,
  /\b\d+(\.\d+)?\s*(oz|lb|lbs|g|kg|ml|l|ct|count|pk|pack|gal|gallon)\b/gi,
  /\b\d+(\.\d+)?\s*[-/]\s*\d+(\.\d+)?\b/g,
  /\b\d+(\.\d+)?\b/g,
];

const PANTRY_BRANDS_SORTED = [...PANTRY_SCAN_STRIP_BRANDS].sort((a, b) => b.length - a.length);
const PANTRY_PHRASE_KEYS_SORTED = Object.keys(PANTRY_SCAN_PHRASE_SYNONYMS).sort(
  (a, b) => b.length - a.length,
);

function stripPantryScanBrands(text: string): string {
  let out = text;
  for (const brand of PANTRY_BRANDS_SORTED) {
    const pattern = new RegExp(`\\b${brand.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    out = out.replace(pattern, ' ');
  }
  return out;
}

const PANTRY_PHRASE_WHOLE_NAME_ONLY = new Set(['oatmeal', 'syrup']);

function applyPantryScanPhraseSynonyms(text: string): string {
  let out = text;
  for (const key of PANTRY_PHRASE_KEYS_SORTED) {
    const replacement = PANTRY_SCAN_PHRASE_SYNONYMS[key] ?? key;
    const pattern = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    if (!pattern.test(out)) continue;
    if (
      replacement.toLowerCase().startsWith(key.toLowerCase()) &&
      new RegExp(`\\b${replacement.replace(/\s+/g, '\\s+')}\\b`, 'i').test(out)
    ) {
      continue;
    }
    if (key === 'syrup' && /\b(?:pancake|maple|corn|chocolate|waffle|breakfast)\s+syrup\b/i.test(out)) {
      continue;
    }
    if (key === 'oatmeal' && /\binstant\s+oatmeal\b/i.test(out)) {
      continue;
    }
    if (PANTRY_PHRASE_WHOLE_NAME_ONLY.has(key)) {
      const whole = new RegExp(`^${key.replace(/\s+/g, '\\s+')}$`, 'i');
      if (!whole.test(out.trim())) continue;
    }
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function normalizeIngredientName(value: string): string {
  let text = value
    .normalize('NFC')
    .toLowerCase()
    .replace(/\[demo sample\]/gi, '')
    .replace(/&/g, ' and ')
    .replace(/(\p{L})['’]s\b/giu, '$1 ')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  text = stripPantryScanBrands(text);
  text = text.replace(/[^ \p{L}\p{N}%./-]/gu, ' ');

  for (const pattern of QUANTITY_PATTERNS) {
    text = text.replace(pattern, ' ');
  }

  text = applyPantryScanPhraseSynonyms(text);
  text = text.replace(/(?:^|\s)s(?=\s|$)/g, ' ');

  return text.replace(/\s+/g, ' ').trim();
}

const PLURAL_KEEP_TOKENS = new Set(['beans']);

function singularizeToken(token: string): string {
  if (token === 'halves') return 'half';
  if (PLURAL_KEEP_TOKENS.has(token)) return token;
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('oes') && token.length > 4) {
    return token.slice(0, -2);
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
    .filter((t) => t.length > 0 && !STRIP_TOKENS.has(t) && !/^\d+(\.\d+)?$/.test(t))
    .map(singularizeToken);
}

/** Canonical identity phrase kept for matching (e.g. "chicken breast", not "chicken"). */
export function canonicalIngredientPhrase(value: string): string {
  return tokenizeIngredientName(value).join(' ');
}

function ingredientForms(name: string): string[] {
  const phrase = canonicalIngredientPhrase(name);
  const normalized = normalizeIngredientName(name);
  return [phrase, normalized].filter(Boolean);
}

function tokensEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

function orderedPrefix(shorter: string[], longer: string[]): boolean {
  if (shorter.length >= longer.length) return false;
  return shorter.every((t, i) => t === longer[i]);
}

function nameBelongsToSynonymGroup(name: string, canonical: string, synonyms: readonly string[]): boolean {
  const namePhrase = canonicalIngredientPhrase(name);
  const members = [canonical, ...synonyms];

  for (const member of members) {
    const memberPhrase = canonicalIngredientPhrase(member);
    if (namePhrase && memberPhrase && namePhrase === memberPhrase) return true;
  }
  return false;
}

function pantryMatchesCategoryHead(pantryTokens: string[], family: string): boolean {
  const members = INGREDIENT_CATEGORY_GROUPS[family];
  if (!members) return false;
  const pantryPhrase = pantryTokens.join(' ');
  for (const member of members) {
    const memberTokens = tokenizeIngredientName(member);
    if (memberTokens.length === 0) continue;
    if (tokensEqual(pantryTokens, memberTokens)) return true;
    if (memberTokens.length === 1 && pantryTokens.includes(memberTokens[0])) return true;
    if (pantryPhrase.includes(memberTokens.join(' '))) return true;
  }
  return false;
}

function categoryHeadForRecipeTokens(recipeTokens: string[]): string | null {
  if (recipeTokens.length !== 1) return null;
  const head = recipeTokens[0];
  if (head in INGREDIENT_CATEGORY_GROUPS) return head;
  return null;
}

function specificTypeInFamily(pantryTokens: string[], family: string): boolean {
  const members = INGREDIENT_CATEGORY_GROUPS[family];
  if (!members) return false;
  const phrase = pantryTokens.join(' ');
  for (const member of members) {
    if (member === family) continue;
    const memberPhrase = canonicalIngredientPhrase(member);
    if (memberPhrase && (phrase === memberPhrase || pantryTokens.includes(memberPhrase))) {
      return true;
    }
    const mt = tokenizeIngredientName(member);
    if (mt.length === 1 && pantryTokens.includes(mt[0])) return true;
  }
  return false;
}

/**
 * Hierarchical match: specific pantry satisfies generic recipe; wrong cut/form is substitute only.
 */
export function ingredientMatchScore(recipeLabel: string, pantryLabel: string): number {
  const recipeTokens = tokenizeIngredientName(recipeLabel);
  const pantryTokens = tokenizeIngredientName(pantryLabel);
  if (recipeTokens.length === 0 || pantryTokens.length === 0) return 0;

  if (tokensEqual(recipeTokens, pantryTokens)) return 1;

  for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    const inRecipe = nameBelongsToSynonymGroup(recipeLabel, canonical, synonyms);
    const inPantry = nameBelongsToSynonymGroup(pantryLabel, canonical, synonyms);
    if (inRecipe && inPantry) return 1;
  }

  const family = categoryHeadForRecipeTokens(recipeTokens);
  if (family && pantryMatchesCategoryHead(pantryTokens, family)) {
    return 1;
  }

  if (recipeTokens.length === 1 && pantryTokens.length > 1) {
    const head = recipeTokens[0];
    if (orderedPrefix(recipeTokens, pantryTokens)) {
      const extra = pantryTokens.slice(recipeTokens.length);
      if (extra.every((t) => CUT_MODIFIERS.has(t) || VARIETY_MODIFIERS.has(t))) {
        return 1;
      }
      return 0;
    }
    if (pantryTokens[pantryTokens.length - 1] === head) return 1;
  }

  if (orderedPrefix(pantryTokens, recipeTokens)) {
    const extra = recipeTokens.slice(pantryTokens.length);
    if (extra.length > 0 && extra.every((t) => t in INGREDIENT_CATEGORY_GROUPS)) {
      return 1;
    }
    if (extra.length > 0 && extra.every((t) => CUT_MODIFIERS.has(t))) {
      return INGREDIENT_SUBSTITUTE_MATCH_SCORE;
    }
  }

  if (
    recipeTokens.length > 1 &&
    pantryTokens.length === 1 &&
    recipeTokens[recipeTokens.length - 1] === pantryTokens[0]
  ) {
    const varietyPrefix = recipeTokens.slice(0, -1);
    if (varietyPrefix.every((t) => VARIETY_MODIFIERS.has(t) || STRIP_TOKENS.has(t))) {
      return 1;
    }
  }

  if (
    pantryTokens.length > 1 &&
    recipeTokens.length === 1 &&
    pantryTokens[pantryTokens.length - 1] === recipeTokens[0]
  ) {
    const varietyPrefix = pantryTokens.slice(0, -1);
    if (varietyPrefix.every((t) => VARIETY_MODIFIERS.has(t) || STRIP_TOKENS.has(t))) {
      return 1;
    }
  }

  if (recipeTokens.length > 1 && pantryTokens.length === 1) {
    return INGREDIENT_SUBSTITUTE_MATCH_SCORE;
  }

  if (recipeTokens.length > 1 && pantryTokens.length > 1) {
    if (recipeTokens[0] === pantryTokens[0] && !tokensEqual(recipeTokens, pantryTokens)) {
      return INGREDIENT_SUBSTITUTE_MATCH_SCORE;
    }
  }

  if (recipeTokens.length === 1 && pantryTokens.length > 1) {
    const specific = specificTypeInFamily(pantryTokens, recipeTokens[0]);
    if (specific) return INGREDIENT_SUBSTITUTE_MATCH_SCORE;
  }

  return 0;
}

/** Expand keys for exact/synonym identity only (no generic parent collapse). */
export function expandSynonymKeys(name: string): string[] {
  const keys = new Set<string>();
  for (const form of ingredientForms(name)) keys.add(form);

  for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (!nameBelongsToSynonymGroup(name, canonical, synonyms)) continue;
    keys.add(canonicalIngredientPhrase(canonical));
    keys.add(normalizeIngredientName(canonical));
    for (const syn of synonyms) {
      keys.add(canonicalIngredientPhrase(syn));
      keys.add(normalizeIngredientName(syn));
    }
  }

  const phrase = canonicalIngredientPhrase(name);
  if (phrase) keys.add(phrase);

  return [...keys].filter(Boolean);
}

function headToken(tokens: string[]): string | undefined {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const t = tokens[i];
    if (t && !/^\d+(\.\d+)?$/.test(t)) return t;
  }
  return tokens[tokens.length - 1];
}

function wholeTokenPresent(needle: string, tokens: string[]): boolean {
  return tokens.some((t) => t === needle);
}

function phraseSubsetScore(shortTokens: string[], longTokens: string[]): number {
  if (shortTokens.length === 0 || longTokens.length === 0) return 0;
  if (!shortTokens.every((t) => wholeTokenPresent(t, longTokens))) return 0;

  const shortHead = headToken(shortTokens)!;
  const longHead = headToken(longTokens)!;
  if (shortHead !== longHead) return 0;

  const hierarchical = ingredientMatchScore(shortTokens.join(' '), longTokens.join(' '));
  if (hierarchical >= FUZZY_MATCH_THRESHOLD) return Math.min(0.95, hierarchical);
  if (hierarchical >= INGREDIENT_SUBSTITUTE_MATCH_SCORE) return 0;

  if (shortTokens.length === 1 && longTokens.length === 1) return 0.92;
  return 0.92;
}

export function fuzzyNameScore(a: string, b: string): number {
  const hierarchical = ingredientMatchScore(a, b);
  if (hierarchical > 0) return hierarchical;

  const aNorm = normalizeIngredientName(a);
  const bNorm = normalizeIngredientName(b);
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;

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
  if (!aHead || !bHead || aHead !== bHead) return 0;

  if (aTokens.length > 1 && bTokens.length > 1 && !tokensEqual(aTokens, bTokens)) {
    return 0;
  }

  const unionSize = new Set([...aTokens, ...bTokens]).size;
  return Math.min(
    0.88,
    overlap.length / unionSize + (overlap.length / Math.max(aTokens.length, bTokens.length)) * 0.12,
  );
}

/** Short label for RecipeAPI search queries (specific phrase, not generic collapse). */
export function canonicalIngredientSearchLabel(name: string): string {
  const phrase = canonicalIngredientPhrase(name);
  return phrase || name.trim();
}

export { FUZZY_MATCH_THRESHOLD, INGREDIENT_SYNONYMS, STRIP_TOKENS };
