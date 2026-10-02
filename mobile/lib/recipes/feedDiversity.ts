import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { compareRecipePantryMatches } from '../recipeMatch';
import { cuisineBucket, mainProteinBucket, titleTokenJaccard } from './nearDuplicate';

export interface FeedDiversityOptions {
  topWindow?: number;
  maxPerProtein?: number;
  maxPerCuisine?: number;
  seed?: number;
}

function rowName(row: RecipesTabRow): string {
  return row.kind === 'kitchen' ? row.recipe.name : row.recipe.name;
}

function similarityPenalty(candidate: RecipesTabRow, selected: RecipesTabRow[]): number {
  let penalty = 0;
  for (const row of selected) {
    penalty += titleTokenJaccard(rowName(candidate), rowName(row));
    if (mainProteinBucket(candidate) === mainProteinBucket(row)) penalty += 0.35;
    if (cuisineBucket(candidate) === cuisineBucket(row)) penalty += 0.2;
  }
  return penalty;
}

function baseScore(row: RecipesTabRow): number {
  return row.match.matchedCount * 100 + row.match.percentMatch - row.match.missingCount;
}

function compareRows(a: RecipesTabRow, b: RecipesTabRow): number {
  return compareRecipePantryMatches(a.match, b.match);
}

function proteinCount(rows: RecipesTabRow[], protein: string): number {
  return rows.filter((row) => mainProteinBucket(row) === protein).length;
}

function cuisineCount(rows: RecipesTabRow[], cuisine: string): number {
  return rows.filter((row) => cuisineBucket(row) === cuisine).length;
}

function withinTopCaps(row: RecipesTabRow, head: RecipesTabRow[], maxPerProtein: number, maxPerCuisine: number): boolean {
  const protein = mainProteinBucket(row);
  const cuisine = cuisineBucket(row);
  return (
    proteinCount(head, protein) < maxPerProtein && cuisineCount(head, cuisine) < maxPerCuisine
  );
}

/**
 * Build a diverse head (max 2 per protein/cuisine in the first `topWindow` slots), then append the rest.
 */
export function applyFeedDiversity(
  rows: readonly RecipesTabRow[],
  options: FeedDiversityOptions = {},
): RecipesTabRow[] {
  const topWindow = options.topWindow ?? 10;
  const maxPerProtein = options.maxPerProtein ?? 2;
  const maxPerCuisine = options.maxPerCuisine ?? 2;
  const seed = options.seed ?? 0;

  if (rows.length <= 1) return [...rows];

  const sorted = [...rows].sort(compareRows);
  const start = seed % sorted.length;
  const pool = [...sorted.slice(start), ...sorted.slice(0, start)];

  const head: RecipesTabRow[] = [];

  while (head.length < topWindow && pool.length > 0) {
    let pickIndex = -1;
    let pickScore = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];
      if (!withinTopCaps(candidate, head, maxPerProtein, maxPerCuisine)) continue;
      const score = baseScore(candidate) - similarityPenalty(candidate, head) * 40;
      if (score > pickScore) {
        pickScore = score;
        pickIndex = i;
      }
    }

    if (pickIndex < 0) break;

    const [picked] = pool.splice(pickIndex, 1);
    head.push(picked);
  }

  const tailAllowed: RecipesTabRow[] = [];
  const tailDeferred: RecipesTabRow[] = [];

  for (const row of pool.sort(compareRows)) {
    const headPlusTail = [...head, ...tailAllowed];
    if (headPlusTail.length < topWindow && !withinTopCaps(row, headPlusTail, maxPerProtein, maxPerCuisine)) {
      tailDeferred.push(row);
      continue;
    }
    tailAllowed.push(row);
  }

  return [...head, ...tailAllowed, ...tailDeferred.sort(compareRows)];
}
