/** Drop non-recipe YouTube uploads (vlogs, mukbang, Q&A, hauls, etc.). */

const NON_RECIPE_TITLE = new RegExp(
  '\\b(vlog|mukbang|prank|q\\s*&\\s*a|qa|haul|unboxing|giveaway|merch|podcast|react|reaction|shorts compilation|behind the scenes|bts|what i eat in a day|wieiad|grocery haul|room tour|day in my life|asmr eating)\\b',
  'i',
);

/** Hard excludes — title only (never description boilerplate). */
const EXCLUDE_TITLE = new RegExp(
  '\\b(' +
    'i tried|every country|\\$\\s*1\\s*vs|ranked|ranks|taste test|mukbang|' +
    'review|blender|knives|burner|protein bars|equipment|' +
    'taking a break|retirement|feedback|announcement|' +
    'full episode|recap|beat bobby flay|chopped|restaurant impossible|diners, drive-ins|' +
    '\\bhacks\\b|challenge|mystery|last meals|gear heads|kitchen tools|gadget|' +
    'levels of|tasters|\\brate\\b|explains|what does|how to pick|answering|' +
    'questions|takes on|controversial' +
  ')\\b',
  'i',
);

/** Subscriber / milestone videos — title only (descriptions often mention subscribers). */
const EXCLUDE_CHANNEL_NEWS_TITLE = new RegExp(
  '\\b(subscribers|thank you to our \\d|million subscribers)\\b',
  'i',
);

const EXCLUDE_VS = /\s+vs\.?\s+/i;

const EXCLUDE_LIVE_PREFIX = /^LIVE:/i;

const EXCLUDE_TOOLS_IN_TITLE = /\b(tools|kitchen tools)\b/i;

const GEAR_BEST_UNDER = /\bbest\b.{0,40}\bunder\s*\$/i;

/** Meal-focused grocery / budget challenges (keep) override generic "challenge" noise. */
const MEAL_CHALLENGE_KEEP = new RegExp(
  '\\b(' +
    '(\\d+\\s+)?cheap\\s+dinners?|budget\\s+meals?|' +
    'grocery\\s+challenge|\\$\\d+\\s+grocery\\s+challenge' +
  ').{0,50}\\b(dinners?|meals?|recipes?|week)\\b|\\b(dinners?|meals?|recipes?)\\b.{0,50}\\b(grocery\\s+challenge|\\$\\d+\\s+grocery)\\b',
  'i',
);

const TITLE_RECIPE_SIGNAL = new RegExp(
  '\\b(' +
    'recipe|recipes|cook|cooking|bake|baking|dinner|dinners|lunch|breakfast|brunch|meal|meals|' +
    'meal prep|air fryer|instant pot|slow cooker|soup|stew|curry|pasta|chicken|beef|steak|salmon|' +
    'tacos|salad|dessert|cookies|cake|how to make|sheet pan|one[- ]pan|one[- ]pot|shakshuka|rag[uù]|' +
    'bolognese|tenders|orange chicken|budget|turkey|pork|vegetables|' +
    'burger|pizza|rice|bread|potato|potatoes|shrimp|ramen|sandwich|chili|casserole|fish|poach|ice cream|' +
    'fed my family|\\$\\d+\\s+meal' +
  ')\\b',
  'i',
);

const INGREDIENTS_HEADING = /\bingredients\b/i;

const MEASURED_QUANTITY = new RegExp(
  '\\b\\d+(?:\\.\\d+)?\\s*(?:' +
    'cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|' +
    'oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|liter|litre|liters|litres' +
  ')\\b',
  'i',
);

const BUDGET_KEYWORDS = new RegExp(
  '\\b(budget|cheap|affordable|frugal|dollar|under \\$|meal prep|pantry|leftovers|grocery challenge)\\b',
  'i',
);

const QUICK_TITLE = new RegExp(
  '\\b(' +
    '15[- ]?minute|20[- ]?minute|30[- ]?minute|quick|easy weeknight|one pan|one[- ]pan|one[- ]pot|' +
    'sheet pan|air fryer|5[- ]ingredient|five[- ]ingredient|lazy' +
  ')\\b',
  'i',
);

export function hasIngredientOrMeasurementSignal(description: string): boolean {
  const text = description.trim();
  if (!text) return false;
  if (INGREDIENTS_HEADING.test(text)) return true;
  return MEASURED_QUANTITY.test(text);
}

export function hasTitleRecipeSignal(title: string): boolean {
  return TITLE_RECIPE_SIGNAL.test(title.trim());
}

export function isExcludedNonRecipeContent(title: string, descriptionSnippet: string): boolean {
  const titleText = title.trim();
  const combined = `${titleText} ${descriptionSnippet}`.trim();
  if (!combined) return true;

  if (MEAL_CHALLENGE_KEEP.test(titleText)) return false;

  if (NON_RECIPE_TITLE.test(combined)) return true;
  if (EXCLUDE_CHANNEL_NEWS_TITLE.test(titleText)) return true;
  if (EXCLUDE_LIVE_PREFIX.test(titleText)) return true;
  if (EXCLUDE_VS.test(titleText)) return true;
  if (EXCLUDE_TOOLS_IN_TITLE.test(titleText)) return true;
  if (EXCLUDE_TITLE.test(titleText)) return true;
  if (GEAR_BEST_UNDER.test(titleText)) return true;

  return false;
}

export function isRecipeLikeVideo(title: string, descriptionSnippet: string): boolean {
  const titleText = title.trim();
  const description = descriptionSnippet.trim();
  if (!titleText && !description) return false;

  if (isExcludedNonRecipeContent(titleText, description)) return false;
  if (hasTitleRecipeSignal(titleText)) return true;
  if (hasIngredientOrMeasurementSignal(description)) return true;
  return false;
}

/** Hide hack/listicle and other non-recipe rows from mixed feeds (e.g. popular). */
export function isLowQualityFeedVideo(title: string, descriptionSnippet: string): boolean {
  return isExcludedNonRecipeContent(title, descriptionSnippet);
}

export function matchesBudgetFeed(title: string, descriptionSnippet: string): boolean {
  return BUDGET_KEYWORDS.test(`${title} ${descriptionSnippet}`);
}

export function matchesQuickFeed(
  title: string,
  _descriptionSnippet: string,
  _durationSeconds: number | null,
  _isShort: boolean,
): boolean {
  return QUICK_TITLE.test(title.trim());
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
