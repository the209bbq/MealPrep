/** User-facing copy and defaults for main-ingredient recipe filtering. */

export const MAIN_INGREDIENT_COPY = {
  cookWithLabel: 'Cook with:',
  builtAround: (label: string) => `Recipes built around ${label}`,
  emptyFiltered:
    'No recipes look centered on that ingredient yet. Try another chip or clear the filter to browse everything.',
  cookWithThisAction: 'Cook with this',
  clearFilter: 'Clear ingredient filter',
} as const;

/** Suggested chips when pantry is empty or to pad suggestions. */
export const COMMON_MAIN_INGREDIENT_CHIPS: readonly { id: string; label: string }[] = [
  { id: 'chicken', label: 'Chicken' },
  { id: 'ground_beef', label: 'Ground beef' },
  { id: 'rice', label: 'Rice' },
  { id: 'pasta', label: 'Pasta' },
  { id: 'salmon', label: 'Salmon' },
  { id: 'tofu', label: 'Tofu' },
];

/** Minimum share of recipe weight for a matched primary ingredient (when not in title / top-3). */
export const MAIN_INGREDIENT_WEIGHT_SHARE_THRESHOLD = 0.12;
