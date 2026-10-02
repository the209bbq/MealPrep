import { PANTRY_DISCOVERY_MAX_PAGE } from './pantryQueryPlans';
import type { PantryDiscoverySearchPlan } from './pantryQueryPlans';

const BROWSE_DISCOVERY_TERMS = [
  'chicken',
  'pasta',
  'rice',
  'soup',
  'salad',
  'beef',
  'vegetarian',
  'breakfast',
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash;
}

/** RecipeAPI queries when the pantry is empty — browse the online catalog. */
export function buildBrowseDiscoverySearchPlans(seed = 0, maxQueries = 5): PantryDiscoverySearchPlan[] {
  const start = ((seed % BROWSE_DISCOVERY_TERMS.length) + BROWSE_DISCOVERY_TERMS.length) % BROWSE_DISCOVERY_TERMS.length;
  const rotated = [...BROWSE_DISCOVERY_TERMS.slice(start), ...BROWSE_DISCOVERY_TERMS.slice(0, start)];
  const plans: PantryDiscoverySearchPlan[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < rotated.length && plans.length < maxQueries; index += 1) {
    const search = rotated[index];
    const key = search.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const mixed = Math.abs(hashString(`${seed}:${index}:${key}`));
    plans.push({
      search,
      ingredients: search,
      page: 1 + (mixed % PANTRY_DISCOVERY_MAX_PAGE),
      planKey: key,
    });
  }

  return plans;
}
