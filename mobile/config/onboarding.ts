import type { Href } from 'expo-router';
import { APP_ROUTES } from './appRoutes';

export type OnboardingBenefitId = 'scan' | 'recipes' | 'grocery' | 'smartShop';

export type OnboardingIoniconName =
  | 'camera-outline'
  | 'restaurant-outline'
  | 'cart-outline'
  | 'storefront-outline'
  | 'home-outline'
  | 'leaf-outline'
  | 'pricetags-outline';

export type OnboardingBenefit = {
  id: OnboardingBenefitId;
  icon: OnboardingIoniconName;
  title: string;
  body: string;
};

export type OnboardingTourStepId = 'pantry' | 'recipes' | 'grocery';

export type OnboardingTourStep = {
  id: OnboardingTourStepId;
  icon: OnboardingIoniconName;
  title: string;
  body: string;
  tabHint: string;
};

export type OnboardingTabEmptyId = 'home' | 'pantry' | 'recipes' | 'grocery';

export type OnboardingTabEmptyCopy = {
  icon: OnboardingIoniconName;
  title: string;
  body: string;
  ctaLabel: string;
  href: Href;
};

export type OnboardingCopy = {
  welcome: {
    valueProp: string;
    benefits: readonly OnboardingBenefit[];
    primaryCta: string;
    secondaryCta: string;
  };
  tour: {
    steps: readonly OnboardingTourStep[];
    skip: string;
    next: string;
    finishTitle: string;
    finishBody: string;
    finishCta: string;
  };
  profile: {
    showTourAgainTitle: string;
    showTourAgainBlurb: string;
    showTourAgainButton: string;
  };
  emptyStates: Record<OnboardingTabEmptyId, OnboardingTabEmptyCopy>;
};

/** Plain-language onboarding copy (welcome, tour, tab empty states). */
export const ONBOARDING_COPY: OnboardingCopy = {
  welcome: {
    valueProp: 'Save time, money, and extra store runs — cook from what you already have.',
    benefits: [
      {
        id: 'scan',
        icon: 'camera-outline',
        title: 'Scan what you have',
        body: 'Snap your shelves once. We remember what is in your kitchen.',
      },
      {
        id: 'recipes',
        icon: 'restaurant-outline',
        title: 'Get recipes from your pantry',
        body: 'See meals you can make with the food you already bought.',
      },
      {
        id: 'grocery',
        icon: 'cart-outline',
        title: 'Build your grocery list automatically',
        body: 'Missing ingredients go on your list — not duplicate buys.',
      },
      {
        id: 'smartShop',
        icon: 'storefront-outline',
        title: 'Find the cheapest nearby store',
        body: 'Compare prices around Modesto so you spend less on the same list.',
      },
    ],
    primaryCta: 'Get started',
    secondaryCta: 'Look around first',
  },
  tour: {
    steps: [
      {
        id: 'pantry',
        icon: 'leaf-outline',
        title: 'Start with your Pantry',
        body: 'Open the Pantry tab and scan or add what you have at home. Everything else builds from here.',
        tabHint: 'Pantry tab',
      },
      {
        id: 'recipes',
        icon: 'restaurant-outline',
        title: 'Pick recipes that fit',
        body: 'The Recipes tab shows meals matched to your pantry so you cook instead of guessing.',
        tabHint: 'Recipes tab',
      },
      {
        id: 'grocery',
        icon: 'pricetags-outline',
        title: 'Shop smart from your list',
        body: 'Grocery List keeps what you still need to buy. Smart Shop finds the best nearby prices.',
        tabHint: 'Grocery List tab',
      },
    ],
    skip: 'Skip',
    next: 'Next',
    finishTitle: 'You are ready',
    finishBody: 'Your best first move is a quick pantry scan. It unlocks recipes and your shopping list.',
    finishCta: 'Scan your pantry',
  },
  profile: {
    showTourAgainTitle: 'App tour',
    showTourAgainBlurb: 'Replay the short walkthrough of Pantry, Recipes, and Grocery List.',
    showTourAgainButton: 'Show tour again',
  },
  emptyStates: {
    home: {
      icon: 'home-outline',
      title: 'Your kitchen hub',
      body: 'Scan your pantry first — we will show your next step here.',
      ctaLabel: 'Scan pantry',
      href: APP_ROUTES.pantry,
    },
    pantry: {
      icon: 'camera-outline',
      title: 'Your pantry is empty',
      body: 'Scan a shelf or add a few items so we know what you can cook.',
      ctaLabel: 'Scan pantry',
      href: APP_ROUTES.pantry,
    },
    recipes: {
      icon: 'restaurant-outline',
      title: 'Add your pantry to see recipes',
      body: 'We match meals to what you already have — start with a quick scan.',
      ctaLabel: 'Go to Pantry',
      href: APP_ROUTES.pantry,
    },
    grocery: {
      icon: 'cart-outline',
      title: 'Nothing on your list yet',
      body: 'Pick a recipe or add missing items from your pantry — we build the list for you.',
      ctaLabel: 'Browse recipes',
      href: APP_ROUTES.recipes,
    },
  },
};
