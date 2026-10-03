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
import { LruCache } from './lruCache';

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

const NORMALIZE_CACHE = new LruCache<string, string>(4096);
const TOKENIZE_CACHE = new LruCache<string, string[]>(4096);
const PHRASE_CACHE = new LruCache<string, string>(4096);
const INGREDIENT_MATCH_CACHE = new LruCache<string, number>(8192);
const FUZZY_SCORE_CACHE = new LruCache<string, number>(8192);

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

function normalizeIngredientNameCore(value: string): string {
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

function tokenizeIngredientNameCore(value: string): string[] {
  const normalized = normalizeIngredientNameCore(value);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter((t) => t.length > 0 && !STRIP_TOKENS.has(t) && !/^\d+(\.\d+)?$/.test(t))
    .map(singularizeToken);
}

function canonicalIngredientPhraseCore(value: string): string {
  return tokenizeIngredientNameCore(value).join(' ');
}

/** Maps canonical ingredient phrase → synonym group key (built once at module load). */
const PHRASE_TO_SYNONYM_GROUP = new Map<string, string>();

function buildSynonymLookup(): void {
  for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    for (const member of [canonical, ...synonyms]) {
      const phrase = canonicalIngredientPhraseCore(member);
      if (phrase) PHRASE_TO_SYNONYM_GROUP.set(phrase, canonical);
      const normalized = normalizeIngredientNameCore(member);
      if (normalized) PHRASE_TO_SYNONYM_GROUP.set(normalized, canonical);
    }
  }
}

interface CategoryMemberIndex {
  raw: string;
  tokens: string[];
  phrase: string;
  singleToken: string | null;
}

const CATEGORY_MEMBER_INDEX: Record<string, CategoryMemberIndex[]> = {};

function buildCategoryMemberIndex(): void {
  for (const [family, members] of Object.entries(INGREDIENT_CATEGORY_GROUPS)) {
    CATEGORY_MEMBER_INDEX[family] = members.map((member) => {
      const tokens = tokenizeIngredientNameCore(member);
      return {
        raw: member,
        tokens,
        phrase: tokens.join(' '),
        singleToken: tokens.length === 1 ? tokens[0] : null,
      };
    });
  }
}

buildSynonymLookup();
buildCategoryMemberIndex();

export function normalizeIngredientName(value: string): string {
  const cached = NORMALIZE_CACHE.get(value);
  if (cached !== undefined) return cached;
  const result = normalizeIngredientNameCore(value);
  NORMALIZE_CACHE.set(value, result);
  return result;
}

export function tokenizeIngredientName(value: string): string[] {
  const cached = TOKENIZE_CACHE.get(value);
  if (cached !== undefined) return cached;
  const result = tokenizeIngredientNameCore(value);
  TOKENIZE_CACHE.set(value, result);
  return result;
}

/** Canonical identity phrase kept for matching (e.g. "chicken breast", not "chicken"). */
export function canonicalIngredientPhrase(value: string): string {
  const cached = PHRASE_CACHE.get(value);
  if (cached !== undefined) return cached;
  const result = canonicalIngredientPhraseCore(value);
  PHRASE_CACHE.set(value, result);
  return result;
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

function nameBelongsToSynonymGroup(name: string, canonical: string, _synonyms: readonly string[]): boolean {
  const namePhrase = canonicalIngredientPhrase(name);
  if (!namePhrase) return false;
  return PHRASE_TO_SYNONYM_GROUP.get(namePhrase) === canonical;
}

function pantryMatchesCategoryHead(pantryTokens: string[], family: string): boolean {
  const members = CATEGORY_MEMBER_INDEX[family];
  if (!members) return false;
  const pantryPhrase = pantryTokens.join(' ');
  for (const member of members) {
    if (member.tokens.length === 0) continue;
    if (tokensEqual(pantryTokens, member.tokens)) return true;
    if (member.singleToken && pantryTokens.includes(member.singleToken)) return true;
    if (member.phrase && pantryPhrase.includes(member.phrase)) return true;
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
  const members = CATEGORY_MEMBER_INDEX[family];
  if (!members) return false;
  const phrase = pantryTokens.join(' ');
  for (const member of members) {
    if (member.raw === family) continue;
    const memberPhrase = member.phrase;
    if (memberPhrase && (phrase === memberPhrase || pantryTokens.includes(memberPhrase))) {
      return true;
    }
    if (member.singleToken && pantryTokens.includes(member.singleToken)) return true;
  }
  return false;
}

function ingredientMatchScoreCore(recipeLabel: string, pantryLabel: string): number {
  const recipeTokens = tokenizeIngredientName(recipeLabel);
  const pantryTokens = tokenizeIngredientName(pantryLabel);
  if (recipeTokens.length === 0 || pantryTokens.length === 0) return 0;

  if (tokensEqual(recipeTokens, pantryTokens)) return 1;

  const recipePhrase = recipeTokens.join(' ');
  const pantryPhrase = pantryTokens.join(' ');
  const recipeGroup = PHRASE_TO_SYNONYM_GROUP.get(recipePhrase);
  const pantryGroup = PHRASE_TO_SYNONYM_GROUP.get(pantryPhrase);
  if (recipeGroup && recipeGroup === pantryGroup) return 1;

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

/**
 * Hierarchical match: specific pantry satisfies generic recipe; wrong cut/form is substitute only.
 */
export function ingredientMatchScore(recipeLabel: string, pantryLabel: string): number {
  const cacheKey = `${recipeLabel}\u0000${pantryLabel}`;
  const cached = INGREDIENT_MATCH_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  const result = ingredientMatchScoreCore(recipeLabel, pantryLabel);
  INGREDIENT_MATCH_CACHE.set(cacheKey, result);
  return result;
}

/** Expand keys for exact/synonym identity only (no generic parent collapse). */
/** Pantry scan dedupe: exact normalized phrase or explicit INGREDIENT_SYNONYMS group only. */
export function areSameIngredientForPantryDedupe(a: string, b: string): boolean {
  const phraseA = canonicalIngredientPhrase(a);
  const phraseB = canonicalIngredientPhrase(b);
  if (phraseA && phraseB && phraseA === phraseB) return true;
  const groupA = phraseA ? PHRASE_TO_SYNONYM_GROUP.get(phraseA) : undefined;
  const groupB = phraseB ? PHRASE_TO_SYNONYM_GROUP.get(phraseB) : undefined;
  return groupA != null && groupA === groupB;
}

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

function fuzzyNameScoreCore(a: string, b: string): number {
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

export function fuzzyNameScore(a: string, b: string): number {
  const cacheKey = `${a}\u0000${b}`;
  const cached = FUZZY_SCORE_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  const result = fuzzyNameScoreCore(a, b);
  FUZZY_SCORE_CACHE.set(cacheKey, result);
  return result;
}

/** Short label for RecipeAPI search queries (specific phrase, not generic collapse). */
export function canonicalIngredientSearchLabel(name: string): string {
  const phrase = canonicalIngredientPhrase(name);
  return phrase || name.trim();
}

export { FUZZY_MATCH_THRESHOLD, INGREDIENT_SYNONYMS, STRIP_TOKENS };
