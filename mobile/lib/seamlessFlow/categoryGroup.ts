/** TheMealDB / recipe category groups (personalization v2 §3.1). */
export type RecipeCategoryGroup = 'breakfast' | 'light' | 'dessert' | 'main' | 'unknown';

const BREAKFAST_KEYWORDS =
  /\b(pancakes?|waffles?|eggs?|omelett?e|oats?|oatmeal|granola|smoothie|toast|frittata|crepes?|blini|boxty|breakfast|congee|porridge|muffins?|bagels?|granola|hash browns?|french toast)\b/i;
const LIGHT_KEYWORDS = /\b(salad|sandwich|wrap|soup|bowl)\b/i;
const MAIN_DISH_KEYWORDS =
  /\b(fried rice|curry|stew|chili|lasagna|meatloaf|roast|braised|tacos?|enchiladas?|casserole|stir[- ]?fry|biryani|risotto|paella|burgers?|meatballs?)\b/i;

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
  if (MAIN_DISH_KEYWORDS.test(text)) {
    return 'main';
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
