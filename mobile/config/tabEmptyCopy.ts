import type { ComponentProps } from 'react';
import type { Ionicons } from '../lib/icons/Ionicons';

export type TabEmptyCopyId = 'pantry' | 'recipes_pantry' | 'grocery';

export type TabEmptyCopy = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
};

/** Short empty-state copy for main tabs (no guided onboarding). */
export const TAB_EMPTY_COPY: Record<TabEmptyCopyId, TabEmptyCopy> = {
  pantry: {
    icon: 'camera-outline',
    title: 'Your pantry is empty',
    body: 'Scan a shelf or add items so we know what you can cook.',
  },
  recipes_pantry: {
    icon: 'restaurant-outline',
    title: 'Add pantry items to see recipes',
    body: 'We match meals to what you already have once your pantry has a few ingredients.',
  },
  grocery: {
    icon: 'cart-outline',
    title: 'Nothing on your list yet',
    body: 'Missing ingredients from recipes show up here automatically.',
  },
};
