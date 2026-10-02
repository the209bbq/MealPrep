import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { compareRecipePantryMatches } from '../recipeMatch';

/** Normalized title key for de-duplicating kitchen vs online recipes. */
export function normalizeRecipeTitleForDedup(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function recipesTabRowDisplayName(row: RecipesTabRow): string {
  return row.kind === 'kitchen' ? row.recipe.name : row.recipe.name;
}

export function recipesTabRowSearchHaystack(row: RecipesTabRow): string {
  if (row.kind === 'kitchen') {
    return `${row.recipe.name} ${row.recipe.description} ${row.recipe.tag}`;
  }
  return `${row.recipe.name} ${row.recipe.description} ${row.recipe.cuisine}`;
}

export function recipesTabRowMatchesSearch(row: RecipesTabRow, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return recipesTabRowSearchHaystack(row).toLowerCase().includes(trimmed);
}

/**
 * Merge kitchen + discovery rows; prefer kitchen catalog when titles match.
 * Also drops duplicate discovery rows that share the same recipeapi id.
 */
export function dedupeRecipesTabRows(rows: readonly RecipesTabRow[]): RecipesTabRow[] {
  const seenApiIds = new Set<number>();
  const byTitle = new Map<string, RecipesTabRow>();
  const ordered: RecipesTabRow[] = [];

  for (const row of rows) {
    if (row.kind === 'discovery') {
      if (seenApiIds.has(row.recipe.id)) continue;
      seenApiIds.add(row.recipe.id);
    }

    const titleKey = normalizeRecipeTitleForDedup(recipesTabRowDisplayName(row));
    const existing = byTitle.get(titleKey);
    if (!existing) {
      byTitle.set(titleKey, row);
      ordered.push(row);
      continue;
    }
    if (existing.kind === 'discovery' && row.kind === 'kitchen') {
      const index = ordered.indexOf(existing);
      if (index >= 0) ordered[index] = row;
      byTitle.set(titleKey, row);
    }
  }

  return ordered;
}

export function rankRecipesTabRows(rows: readonly RecipesTabRow[]): RecipesTabRow[] {
  return [...rows].sort((a, b) => compareRecipePantryMatches(a.match, b.match));
}

export function buildUnifiedRecipesFeed(
  rows: readonly RecipesTabRow[],
  searchQuery: string,
): RecipesTabRow[] {
  const deduped = dedupeRecipesTabRows(rows);
  const ranked = rankRecipesTabRows(deduped);
  if (!searchQuery.trim()) return ranked;
  return ranked.filter((row) => recipesTabRowMatchesSearch(row, searchQuery));
}
