import {
  FISH_SHELLFISH_DIET_PHRASES,
  MEAT_POULTRY_KEYWORDS,
  TRACKED_DIETS,
  VEGAN_ANIMAL_KEYWORDS,
} from '../../config/dietRules';
import {
  allergensForLineParts,
  expandIngredientSegments,
  haystackForLine,
  phraseMatchesHaystack,
} from './allergenMatch';
import { normalizeIngredientName, tokenizeIngredientName } from '../recipeMatch/ingredientNormalize';
import type { AllergenId, DietId, RecipeDietTagResult } from './types';

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

function lineMatchesKeyword(haystack: string, keyword: string): boolean {
  return phraseMatchesHaystack(haystack, keyword);
}

export function allergensForLine(line: string): AllergenId[] {
  const segments = expandIngredientSegments(line);
  const merged = new Set<AllergenId>();
  for (const segment of segments) {
    const haystack = haystackForLine(segment);
    for (const allergen of allergensForLineParts(haystack).allergens) {
      merged.add(allergen);
    }
  }
  return [...merged];
}

export function ingredientLinesMatchingAllergen(
  ingredientLines: string[],
  allergen: AllergenId,
): string[] {
  return ingredientLines.filter((line) => allergensForLine(line).includes(allergen));
}

function failsVegetarianFromHaystacks(haystacks: string[]): boolean {
  for (const haystack of haystacks) {
    for (const keyword of MEAT_POULTRY_KEYWORDS) {
      if (lineMatchesKeyword(haystack, keyword)) return true;
    }
    for (const phrase of FISH_SHELLFISH_DIET_PHRASES) {
      if (lineMatchesKeyword(haystack, phrase)) return true;
    }
  }
  return false;
}

function failsPescatarianFromHaystacks(haystacks: string[]): boolean {
  for (const haystack of haystacks) {
    for (const keyword of MEAT_POULTRY_KEYWORDS) {
      if (keyword === 'gelatin') continue;
      if (lineMatchesKeyword(haystack, keyword)) return true;
    }
  }
  return false;
}

function failsVeganFromHaystacks(segments: string[], haystacks: string[]): boolean {
  if (failsVegetarianFromHaystacks(haystacks)) return true;
  for (let index = 0; index < segments.length; index += 1) {
    const haystack = haystacks[index]!;
    for (const keyword of VEGAN_ANIMAL_KEYWORDS) {
      if (lineMatchesKeyword(haystack, keyword)) return true;
    }
    const tagged = allergensForLine(segments[index]!);
    if (tagged.some((a) => a === 'milk' || a === 'egg' || a === 'fish' || a === 'shellfish')) {
      return true;
    }
  }
  return false;
}

function dietFailuresForLine(segments: string[], haystacks: string[]): Partial<Record<DietId, boolean>> {
  return {
    vegetarian: failsVegetarianFromHaystacks(haystacks),
    vegan: failsVeganFromHaystacks(segments, haystacks),
    pescatarian: failsPescatarianFromHaystacks(haystacks),
  };
}

function dislikeHit(line: string, dislikes: string[]): boolean {
  if (dislikes.length === 0) return false;
  const segments = expandIngredientSegments(line);
  for (const segment of segments) {
    const haystack = haystackForLine(segment);
    const tokens = tokenizeIngredientName(haystack);
    for (const dislike of dislikes) {
      const normalized = normalizeIngredientName(dislike);
      if (!normalized) continue;
      if (phraseMatchesHaystack(haystack, normalized)) return true;
      const dislikeTokens = tokenizeIngredientName(normalized);
      if (dislikeTokens.length === 1 && tokens.includes(dislikeTokens[0]!)) return true;
      if (dislikeTokens.length > 1 && dislikeTokens.every((t) => tokens.includes(t))) return true;
    }
  }
  return false;
}

function processIngredientSegment(
  segment: string,
  lineLabel: string,
  containsAllergens: Set<AllergenId>,
  unknownItems: string[],
  reasons: string[],
  haystack = haystackForLine(segment),
): void {
  if (isVagueIngredient(segment)) {
    unknownItems.push(lineLabel);
    reasons.push(`Unknown: ${lineLabel}`);
    return;
  }
  const { allergens, oatGlutenUncertain } = allergensForLineParts(haystack);
  for (const allergen of allergens) {
    containsAllergens.add(allergen);
  }
  if (oatGlutenUncertain) {
    unknownItems.push(lineLabel);
    reasons.push(`Gluten uncertain (oats): ${lineLabel}`);
  }
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
    const segments = expandIngredientSegments(line);
    const haystacks = segments.map((segment) => haystackForLine(segment));
    for (let index = 0; index < segments.length; index += 1) {
      processIngredientSegment(
        segments[index]!,
        line,
        containsAllergens,
        unknownItems,
        reasons,
        haystacks[index]!,
      );
    }

    const failures = dietFailuresForLine(segments, haystacks);
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
    unknown_items: [...new Set(unknownItems)],
    diets_ok,
    diets_fail: dietsFail,
    dislikes_hit: dislikesHit,
    reasons,
  };
}
