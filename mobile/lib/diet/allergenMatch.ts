import { ALLERGEN_KEYWORD_RULES } from '../../config/dietRules';
import { ALLERGEN_PHRASE_OVERRIDES_SORTED } from '../../config/dietAllergenPhrases';
import { normalizeIngredientName } from '../recipeMatch/ingredientNormalize';
import type { AllergenId } from './types';

export function haystackForLine(line: string): string {
  return normalizeIngredientName(line.replace(/-/g, ' '));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word / token boundary match for a normalized phrase inside a normalized haystack. */
export function phraseMatchesHaystack(haystack: string, phrase: string): boolean {
  const normalizedPhrase = normalizeIngredientName(phrase);
  if (!normalizedPhrase) return false;
  const tokens = normalizedPhrase.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const body = tokens.map(escapeRegex).join('\\s+');
  const re = new RegExp(`(?:^|[\\s|,])${body}(?:$|[\\s|,])`, 'i');
  return re.test(haystack);
}

type FlatPhraseRule = { phrase: string; allergens: AllergenId[] };

const GENERIC_PHRASE_RULES: FlatPhraseRule[] = (() => {
  const byPhrase = new Map<string, Set<AllergenId>>();
  for (const rule of ALLERGEN_KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      const key = normalizeIngredientName(keyword);
      if (!key) continue;
      const set = byPhrase.get(key) ?? new Set<AllergenId>();
      for (const allergen of rule.allergens) set.add(allergen);
      byPhrase.set(key, set);
    }
  }
  return [...byPhrase.entries()]
    .map(([phrase, allergens]) => ({ phrase, allergens: [...allergens] }))
    .sort((a, b) => b.phrase.length - a.phrase.length);
})();

function applyFreeFromModifiers(haystack: string, allergens: Set<AllergenId>): void {
  if (/\bdairy[- ]free\b/i.test(haystack) || /\bvegan\b/i.test(haystack)) {
    allergens.delete('milk');
  }
  if (/\begg[- ]free\b/i.test(haystack) || /\bvegan\b/i.test(haystack)) {
    allergens.delete('egg');
  }
  if (/\bvegan\b/i.test(haystack)) {
    allergens.delete('fish');
    allergens.delete('shellfish');
    allergens.delete('egg');
    allergens.delete('milk');
  }
}

export function isOatGlutenUncertain(line: string): boolean {
  const haystack = haystackForLine(line);
  if (/\bgluten[- ]free\s+oats?\b/i.test(haystack)) return false;
  return /\b(oatmeal|rolled oats|regular oats|oats)\b/i.test(haystack);
}

export function overrideAllergensForLine(haystack: string): AllergenId[] | null {
  for (const entry of ALLERGEN_PHRASE_OVERRIDES_SORTED) {
    if (phraseMatchesHaystack(haystack, entry.phrase)) {
      return [...entry.allergens];
    }
  }
  return null;
}

export function genericAllergensForHaystack(haystack: string): AllergenId[] {
  const found = new Set<AllergenId>();
  for (const rule of GENERIC_PHRASE_RULES) {
    if (phraseMatchesHaystack(haystack, rule.phrase)) {
      for (const allergen of rule.allergens) found.add(allergen);
    }
  }
  if (phraseMatchesHaystack(haystack, 'pesto')) {
    found.add('tree_nuts');
    found.add('milk');
  }
  applyFreeFromModifiers(haystack, found);
  return [...found];
}

export function allergensForLineParts(haystack: string): { allergens: AllergenId[]; oatGlutenUncertain: boolean } {
  const override = overrideAllergensForLine(haystack);
  let allergens: AllergenId[];
  if (override != null) {
    allergens = override;
  } else {
    allergens = genericAllergensForHaystack(haystack);
  }
  const oatUncertain = isOatGlutenUncertain(haystack);
  if (oatUncertain) {
    allergens = allergens.filter((a) => a !== 'gluten');
  }
  return { allergens, oatGlutenUncertain: oatUncertain };
}

/** Split compound test / import lines like "cream cheese|eggplant". */
export function expandIngredientSegments(line: string): string[] {
  if (!line.includes('|')) return [line];
  return line
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}
