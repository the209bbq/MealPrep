import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { normalizeRecipeTitleForDedup } from './unifiedFeed';
import { tokenizeIngredientName } from '../recipeMatch/ingredientNormalize';

const TITLE_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'with',
  'for',
  'easy',
  'quick',
  'best',
  'homemade',
  'classic',
  'simple',
  'delicious',
  'recipe',
  'recipes',
]);

export function titleTokensForSimilarity(name: string): Set<string> {
  const normalized = normalizeRecipeTitleForDedup(name);
  const tokens = normalized
    .split(/\s+/)
    .filter((t) => t.length > 1 && !TITLE_STOP_WORDS.has(t));
  return new Set(tokens);
}

/** Jaccard similarity on title tokens (0–1). */
export function titleTokenJaccard(a: string, b: string): number {
  const setA = titleTokensForSimilarity(a);
  const setB = titleTokensForSimilarity(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const PROTEIN_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: 'chicken', pattern: /\b(chicken|poultry)\b/i },
  { id: 'beef', pattern: /\b(beef|steak|brisket)\b/i },
  { id: 'pork', pattern: /\b(pork|carnitas|bacon|ham)\b/i },
  { id: 'turkey', pattern: /\b(turkey)\b/i },
  { id: 'fish', pattern: /\b(salmon|fish|cod|tilapia|tuna)\b/i },
  { id: 'shrimp', pattern: /\b(shrimp|prawn)\b/i },
  { id: 'plant', pattern: /\b(veggie|vegetable|tofu|bean|lentil|chickpea)\b/i },
];

function ingredientNames(row: RecipesTabRow): string[] {
  if (row.kind === 'kitchen') {
    return row.recipe.ingredients.map((ing) => ing.name);
  }
  return row.recipe.ingredients.map((ing) => ing.name);
}

/** Primary protein bucket for diversity caps. */
export function mainProteinBucket(row: RecipesTabRow): string {
  const haystack = `${recipesTabRowName(row)} ${ingredientNames(row).join(' ')}`;
  for (const { id, pattern } of PROTEIN_PATTERNS) {
    if (pattern.test(haystack)) return id;
  }
  return 'other';
}

export function cuisineBucket(row: RecipesTabRow): string {
  if (row.kind === 'kitchen') {
    return row.recipe.tag?.toLowerCase().trim() || 'other';
  }
  return row.recipe.cuisine?.toLowerCase().trim() || 'other';
}

function recipesTabRowName(row: RecipesTabRow): string {
  return row.kind === 'kitchen' ? row.recipe.name : row.recipe.name;
}

/** Normalized set of main (non-staple) ingredient tokens for near-duplicate detection. */
export function mainIngredientTokenSet(row: RecipesTabRow): Set<string> {
  const tokens = new Set<string>();
  for (const name of ingredientNames(row)) {
    for (const token of tokenizeIngredientName(name)) {
      if (token.length > 2) tokens.add(token);
    }
  }
  return tokens;
}

export function sameMainIngredientSet(a: RecipesTabRow, b: RecipesTabRow): boolean {
  const setA = mainIngredientTokenSet(a);
  const setB = mainIngredientTokenSet(b);
  if (setA.size === 0 || setB.size === 0) return false;
  if (setA.size !== setB.size) return false;
  for (const token of setA) {
    if (!setB.has(token)) return false;
  }
  return true;
}

function rowMatchScore(row: RecipesTabRow): number {
  const m = row.match;
  return m.matchedCount * 1000 + m.percentMatch * 10 - m.missingCount;
}

function isNearDuplicate(a: RecipesTabRow, b: RecipesTabRow, titleThreshold: number): boolean {
  const nameA = recipesTabRowName(a);
  const nameB = recipesTabRowName(b);
  if (normalizeRecipeTitleForDedup(nameA) === normalizeRecipeTitleForDedup(nameB)) return true;
  if (titleTokenJaccard(nameA, nameB) >= titleThreshold) return true;
  if (sameMainIngredientSet(a, b)) return true;
  return false;
}

/** Drop near-duplicates; keep the row with stronger pantry match (kitchen wins ties). */
export function collapseNearDuplicateRecipeRows(
  rows: readonly RecipesTabRow[],
  titleJaccardThreshold = 0.7,
): RecipesTabRow[] {
  const kept: RecipesTabRow[] = [];

  for (const row of rows) {
    let replaced = false;
    for (let i = 0; i < kept.length; i += 1) {
      const existing = kept[i];
      if (!isNearDuplicate(existing, row, titleJaccardThreshold)) continue;

      const existingScore = rowMatchScore(existing);
      const rowScore = rowMatchScore(row);
      const preferRow =
        rowScore > existingScore ||
        (rowScore === existingScore && row.kind === 'kitchen' && existing.kind === 'discovery');

      if (preferRow) kept[i] = row;
      replaced = true;
      break;
    }
    if (!replaced) kept.push(row);
  }

  return kept;
}
