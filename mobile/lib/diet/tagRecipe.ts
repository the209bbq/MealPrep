import {
  ALLERGEN_KEYWORD_RULES,
  MEAT_POULTRY_KEYWORDS,
  TRACKED_DIETS,
  VEGAN_ANIMAL_KEYWORDS,
} from '../../config/dietRules';
import { normalizeIngredientName, tokenizeIngredientName } from '../recipeMatch/ingredientNormalize';
import type { AllergenId, DietId, RecipeDietTagResult } from './types';

function haystackForLine(line: string): string {
  return normalizeIngredientName(line);
}

function lineMatchesKeyword(haystack: string, keyword: string): boolean {
  const normalizedKeyword = normalizeIngredientName(keyword);
  if (!normalizedKeyword) return false;
  if (haystack.includes(normalizedKeyword)) return true;
  const tokens = tokenizeIngredientName(haystack);
  const keyTokens = tokenizeIngredientName(normalizedKeyword);
  if (keyTokens.length === 1) {
    return tokens.includes(keyTokens[0]!);
  }
  return keyTokens.every((token) => tokens.includes(token));
}

const NAMED_SAUCE_PATTERN =
  /\b(soy sauce|fish sauce|oyster sauce|hot sauce|worcestershire|hoisin|teriyaki|barbecue sauce|bbq sauce|tomato sauce|pasta sauce)\b/i;

function isVagueIngredient(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  const normalized = haystackForLine(trimmed);
  if (NAMED_SAUCE_PATTERN.test(normalized)) return false;
  if (/\bstore[- ]bought\b/i.test(normalized)) return true;
  if (/\b(broth mix|seasoning mix|spice mix|spice blend)\b/i.test(normalized)) return true;
  if (/\bseasoning\b/i.test(normalized)) return true;
  if (/\bmarinade\b/i.test(normalized) && !NAMED_SAUCE_PATTERN.test(normalized)) return true;
  if (/\bdressing\b/i.test(normalized) && !/\b\w+\s+dressing\b/i.test(normalized)) return true;
  if (/\bsauce\b/i.test(normalized) && !/\b\w+\s+sauce\b/i.test(normalized)) return true;
  if (/^(sauce|seasoning|dressing|marinade|condiment)\b/.test(normalized)) return true;
  return false;
}

export function allergensForLine(line: string): AllergenId[] {
  const haystack = haystackForLine(line);
  const found = new Set<AllergenId>();
  for (const rule of ALLERGEN_KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (lineMatchesKeyword(haystack, keyword)) {
        for (const allergen of rule.allergens) found.add(allergen);
        break;
      }
    }
  }
  if (lineMatchesKeyword(haystack, 'pesto')) {
    found.add('tree_nuts');
    found.add('milk');
  }
  return [...found];
}

export function ingredientLinesMatchingAllergen(
  ingredientLines: string[],
  allergen: AllergenId,
): string[] {
  return ingredientLines.filter((line) => allergensForLine(line).includes(allergen));
}

function failsVegetarian(line: string): boolean {
  const haystack = haystackForLine(line);
  for (const keyword of MEAT_POULTRY_KEYWORDS) {
    if (lineMatchesKeyword(haystack, keyword)) return true;
  }
  const fishShellfish = ['fish', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'anchovy'];
  for (const keyword of fishShellfish) {
    if (lineMatchesKeyword(haystack, keyword)) return true;
  }
  return false;
}

function failsPescatarian(line: string): boolean {
  const haystack = haystackForLine(line);
  for (const keyword of MEAT_POULTRY_KEYWORDS) {
    if (keyword === 'gelatin') continue;
    if (lineMatchesKeyword(haystack, keyword)) return true;
  }
  return false;
}

function failsVegan(line: string): boolean {
  if (failsVegetarian(line)) return true;
  const haystack = haystackForLine(line);
  for (const keyword of VEGAN_ANIMAL_KEYWORDS) {
    if (lineMatchesKeyword(haystack, keyword)) return true;
  }
  const milkEgg = allergensForLine(line);
  if (milkEgg.some((a) => a === 'milk' || a === 'egg' || a === 'fish' || a === 'shellfish')) {
    return true;
  }
  return false;
}

function dietFailuresForLine(line: string): Partial<Record<DietId, boolean>> {
  return {
    vegetarian: failsVegetarian(line),
    vegan: failsVegan(line),
    pescatarian: failsPescatarian(line),
  };
}

function dislikeHit(line: string, dislikes: string[]): boolean {
  if (dislikes.length === 0) return false;
  const haystack = haystackForLine(line);
  const tokens = tokenizeIngredientName(haystack);
  for (const dislike of dislikes) {
    const normalized = normalizeIngredientName(dislike);
    if (!normalized) continue;
    if (haystack.includes(normalized)) return true;
    const dislikeTokens = tokenizeIngredientName(normalized);
    if (dislikeTokens.length === 1 && tokens.includes(dislikeTokens[0]!)) return true;
    if (dislikeTokens.length > 1 && dislikeTokens.every((t) => tokens.includes(t))) return true;
  }
  return false;
}

export function tagRecipe(input: {
  ingredientLines: string[];
  dislikes?: string[];
}): RecipeDietTagResult {
  const lines = input.ingredientLines.map((line) => line.trim()).filter(Boolean);
  const dislikes = (input.dislikes ?? []).map((d) => d.trim()).filter(Boolean);

  const containsAllergens = new Set<AllergenId>();
  const unknownItems: string[] = [];
  const dietsFail: Partial<Record<DietId, string[]>> = {};
  const dislikesHit: string[] = [];
  const reasons: string[] = [];

  for (const line of lines) {
    if (isVagueIngredient(line)) {
      unknownItems.push(line);
      reasons.push(`Unknown: ${line}`);
      continue;
    }

    for (const allergen of allergensForLine(line)) {
      containsAllergens.add(allergen);
    }

    const failures = dietFailuresForLine(line);
    for (const diet of ['vegetarian', 'vegan', 'pescatarian'] as const) {
      if (failures[diet]) {
        const bucket = dietsFail[diet] ?? [];
        bucket.push(line);
        dietsFail[diet] = bucket;
      }
    }

    if (dislikeHit(line, dislikes)) {
      dislikesHit.push(line);
    }
  }

  const diets_ok: DietId[] = [];
  for (const diet of TRACKED_DIETS) {
    if (diet === 'keto') continue;
    const failed = dietsFail[diet];
    if (!failed || failed.length === 0) {
      diets_ok.push(diet);
    }
  }

  if (containsAllergens.size > 0) {
    reasons.push(`Allergens: ${[...containsAllergens].join(', ')}`);
  }

  return {
    contains_allergens: [...containsAllergens],
    unknown_items: unknownItems,
    diets_ok,
    diets_fail: dietsFail,
    dislikes_hit: dislikesHit,
    reasons,
  };
}
