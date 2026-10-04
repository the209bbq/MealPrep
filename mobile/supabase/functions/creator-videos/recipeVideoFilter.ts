/** Drop non-recipe YouTube uploads (vlogs, mukbang, Q&A, hauls, etc.). */

const NON_RECIPE_TITLE = new RegExp(
  '\\b(vlog|mukbang|prank|q\\s*&\\s*a|qa|haul|unboxing|giveaway|merch|podcast|react|reaction|shorts compilation|behind the scenes|bts|what i eat in a day|wieiad|grocery haul|room tour|day in my life|asmr eating)\\b',
  'i',
);

const RECIPE_POSITIVE = new RegExp(
  '\\b(recipe|cook|bake|dinner|lunch|breakfast|meal prep|air fryer|instant pot|slow cooker|soup|stew|curry|pasta|chicken|beef|salmon|tacos|salad|dessert|cookies|cake|how to make)\\b',
  'i',
);

const BUDGET_KEYWORDS = new RegExp(
  '\\b(budget|cheap|affordable|frugal|dollar|under \\$|meal prep|pantry|leftovers)\\b',
  'i',
);

const QUICK_KEYWORDS = new RegExp(
  '\\b(quick|easy|15 min|20 min|30 min|weeknight|one pan|one-pot|sheet pan|fast)\\b',
  'i',
);

export function isRecipeLikeVideo(title: string, descriptionSnippet: string): boolean {
  const haystack = `${title} ${descriptionSnippet}`.trim();
  if (!haystack) return false;
  if (NON_RECIPE_TITLE.test(haystack)) return false;
  return RECIPE_POSITIVE.test(haystack);
}

export function matchesBudgetFeed(title: string, descriptionSnippet: string): boolean {
  return BUDGET_KEYWORDS.test(`${title} ${descriptionSnippet}`);
}

export function matchesQuickFeed(
  title: string,
  descriptionSnippet: string,
  durationSeconds: number | null,
  isShort: boolean,
): boolean {
  if (isShort) return true;
  if (durationSeconds != null && durationSeconds > 0 && durationSeconds <= 20 * 60) return true;
  return QUICK_KEYWORDS.test(`${title} ${descriptionSnippet}`);
}

export function parseIsoDurationSeconds(iso: string | undefined | null): number | null {
  if (!iso || !iso.startsWith('PT')) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = Number.parseInt(match[1] ?? '0', 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  const seconds = Number.parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}
