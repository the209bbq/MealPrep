import { canonicalIngredientSearchLabel } from '../recipeMatch/ingredientNormalize';
import type { PantryItem } from '../../types/mealprep';

const PROTEIN_PHRASES = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'turkey',
  'bacon',
  'sausage',
  'ham',
  'steak',
  'salmon',
  'tuna',
  'shrimp',
  'prawn',
  'cod',
  'fish',
  'tofu',
  'tempeh',
  'egg',
] as const;

function proteinLabelFromPantryName(name: string): string | null {
  const label = canonicalIngredientSearchLabel(name).toLowerCase();
  if (!label) return null;
  for (const phrase of PROTEIN_PHRASES) {
    if (label.includes(phrase)) return phrase.replace(/\s+/g, '_');
  }
  return null;
}

/** Distinct filter.php ingredient slugs from pantry (main proteins first). */
export function mealDbPantryProteinFilters(pantry: PantryItem[], max = 3): string[] {
  const seen = new Set<string>();
  const filters: string[] = [];
  const sorted = [...pantry].sort((a, b) => b.name.length - a.name.length);
  for (const item of sorted) {
    const slug = proteinLabelFromPantryName(item.name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    filters.push(slug);
    if (filters.length >= max) break;
  }
  return filters;
}
