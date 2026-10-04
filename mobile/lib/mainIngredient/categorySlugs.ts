import { normalizeIngredientName, tokenizeIngredientName } from '../recipeMatch/normalize';

/** Broad mains users can pick at category level (chicken → thighs, breast, …). */
export const MAIN_INGREDIENT_CATEGORY_SLUGS: Record<string, readonly string[]> = {
  chicken: ['chicken', 'poultry'],
  beef: ['beef', 'steak', 'brisket', 'hamburger', 'ground beef'],
  pork: ['pork', 'bacon', 'ham', 'sausage', 'carnitas'],
  turkey: ['turkey'],
  fish: ['salmon', 'tuna', 'cod', 'tilapia', 'fish'],
  shrimp: ['shrimp', 'prawn'],
  rice: ['rice', 'jasmine rice', 'basmati rice', 'white rice', 'brown rice'],
  pasta: ['pasta', 'spaghetti', 'penne', 'fettuccine', 'noodles', 'macaroni'],
  tofu: ['tofu', 'tempeh'],
  egg: ['egg', 'eggs'],
  potato: ['potato', 'potatoes', 'sweet potato'],
  beans: ['black beans', 'kidney beans', 'pinto beans', 'chickpeas', 'lentils'],
};

export function slugForMainIngredientLabel(label: string): string {
  const norm = normalizeIngredientName(label);
  return norm.replace(/\s+/g, '_') || 'ingredient';
}

export function categorySlugForLabel(label: string): string | undefined {
  const tokens = tokenizeIngredientName(label);
  const phrase = tokens.join(' ');
  for (const [slug, members] of Object.entries(MAIN_INGREDIENT_CATEGORY_SLUGS)) {
    if (phrase === slug || tokens.includes(slug)) return slug;
    for (const member of members) {
      const memberNorm = normalizeIngredientName(member);
      if (phrase === memberNorm || phrase.includes(memberNorm)) return slug;
    }
  }
  return undefined;
}

export function ingredientTextMatchesCategorySlug(text: string, categorySlug: string): boolean {
  const members = MAIN_INGREDIENT_CATEGORY_SLUGS[categorySlug];
  if (!members) return false;
  const norm = normalizeIngredientName(text);
  const tokens = tokenizeIngredientName(text);
  const phrase = tokens.join(' ');
  if (phrase === categorySlug || tokens.includes(categorySlug)) return true;
  for (const member of members) {
    const memberNorm = normalizeIngredientName(member);
    if (!memberNorm) continue;
    if (norm === memberNorm || norm.includes(memberNorm) || memberNorm.includes(norm)) return true;
    const memberTokens = tokenizeIngredientName(member);
    if (memberTokens.length === 1 && tokens.includes(memberTokens[0])) return true;
  }
  return false;
}
