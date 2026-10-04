export interface MainIngredientPick {
  /** Stable id for chip selection (normalized slug). */
  id: string;
  /** Chip / subtitle label. */
  label: string;
  /** Strings used for ingredient + title matching (includes synonyms). */
  matchTerms: string[];
  /** Optional broad family (e.g. `chicken` matches thighs and breast). */
  categorySlug?: string;
}
