/** Recipes tab creator row + Classic category row (rotation spec). */

export const RECIPES_TAB_SURFACE = {
  /** New visit if Recipes tab render is this long after the last visit, or after cold start. */
  visitGapMs: 10 * 60 * 1000,
  visitStateStorageKey: 'mealprep.recipesTab.visitState',
  sectionExpandedStorageKey: 'mealprep.recipesTab.sectionExpanded',
  surfaceEventsStoragePrefix: 'mealprep.recipesTab.surfaceEvents',
  /** Classic section open on first load; Creators collapsed until expanded (lazy load). */
  defaultClassicExpanded: true,
  defaultCreatorsExpanded: false,
  explorationSwapProbability: 0.3,
  minLifetimeImpressionsForExploration: 3,
  minPassRateToShow: 0.2,
  dietPassRateHalfPoint: 0.5,
  creatorMissHalfLifeDays: 14,
  creatorTasteHalfLifeDays: 30,
  categoryImpressionFatigueHalfLifeDays: 7,
} as const;

export const MEALDB_CATEGORY_ORDER_COLD_START = [
  'Chicken',
  'Beef',
  'Pasta',
  'Vegetarian',
  'Seafood',
  'Breakfast',
  'Dessert',
  'Pork',
  'Side',
  'Starter',
  'Vegan',
  'Lamb',
  'Goat',
  'Miscellaneous',
] as const;

export const MEALDB_CATALOG_CATEGORIES = [
  'Beef',
  'Breakfast',
  'Chicken',
  'Dessert',
  'Goat',
  'Lamb',
  'Miscellaneous',
  'Pasta',
  'Pork',
  'Seafood',
  'Side',
  'Starter',
  'Vegan',
  'Vegetarian',
] as const;

export type MealDbCatalogCategory = (typeof MEALDB_CATALOG_CATEGORIES)[number];

export const RECIPES_TAB_SURFACE_COPY = {
  classicSectionTitle: 'Classic recipes',
  creatorsSectionTitle: 'From creators',
  categoryRowAccessibility: 'Browse classic recipes by category',
} as const;
