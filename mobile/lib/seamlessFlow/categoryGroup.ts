/** TheMealDB / recipe category groups (personalization v2 §3.1). */
export type RecipeCategoryGroup = 'breakfast' | 'light' | 'dessert' | 'main' | 'unknown';

const BREAKFAST_KEYWORDS =
  /\b(pancake|waffle|egg|omelet|oat|granola|smoothie|toast|frittata)\b/i;
const LIGHT_KEYWORDS = /\b(salad|sandwich|wrap|soup|bowl)\b/i;

function haystack(category: string, title: string, tags: string[]): string {
  return [category, title, ...tags].join(' ').toLowerCase();
}

export function recipeCategoryGroup(input: {
  category?: string | null;
  title?: string | null;
  tags?: string[] | null;
}): RecipeCategoryGroup {
  const category = (input.category ?? '').trim();
  const title = (input.title ?? '').trim();
  const tags = input.tags ?? [];
  const text = haystack(category, title, tags);

  if (/^breakfast$/i.test(category) || BREAKFAST_KEYWORDS.test(text)) {
    return 'breakfast';
  }
  if (/^(starter|side)$/i.test(category) || LIGHT_KEYWORDS.test(text)) {
    return 'light';
  }
  if (/^dessert$/i.test(category)) {
    return 'dessert';
  }
  if (
    /^(beef|chicken|lamb|pork|goat|seafood|pasta|vegetarian|vegan|miscellaneous)$/i.test(category)
  ) {
    return 'main';
  }
  return 'unknown';
}
