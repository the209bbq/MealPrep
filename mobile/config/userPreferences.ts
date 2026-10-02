import type { UserPreferences } from '../types/mealprep';

export const USER_PREFERENCE_DEFAULTS: UserPreferences = {
  autoAddMissingToGrocery: true,
  addCheckedItemsToPantry: true,
  shareScanPhotoForTraining: false,
};

export const USER_PREFERENCE_LABELS: Record<keyof UserPreferences, { title: string; blurb: string }> = {
  autoAddMissingToGrocery: {
    title: 'Auto-add missing ingredients',
    blurb: 'When you add a recipe to Meals to make, put missing pantry items on your grocery list (staples skipped).',
  },
  addCheckedItemsToPantry: {
    title: 'Add checked items to pantry',
    blurb: 'When you check off groceries (or clear checked), add them to your pantry with the list quantity.',
  },
  shareScanPhotoForTraining: {
    title: 'Share scan photos to improve the scanner',
    blurb: 'When enabled, shelf photos you opt in during scan review are uploaded privately for admin scanner tuning only.',
  },
};
