import type { Href } from 'expo-router';
import type { HandsOnTutorialStepId } from '../lib/onboarding/tutorialProgress';

export type OnboardingBenefitId = 'scan' | 'recipes' | 'grocery' | 'smartShop';

export type OnboardingIoniconName =
  | 'camera-outline'
  | 'restaurant-outline'
  | 'cart-outline'
  | 'storefront-outline'
  | 'home-outline'
  | 'leaf-outline'
  | 'pricetags-outline'
  | 'checkmark-circle';

export type OnboardingBenefit = {
  id: OnboardingBenefitId;
  icon: OnboardingIoniconName;
  title: string;
  body: string;
};

export type HandsOnTutorialStepCopy = {
  id: HandsOnTutorialStepId;
  icon: OnboardingIoniconName;
  title: string;
  body: string;
  primaryCta: string;
  secondaryCta?: string;
  /** Route opened by the primary CTA. */
  primaryHref: Href;
  /** Optional query string for pantry actions (`scan` | `manual`). */
  primaryPantryAction?: 'scan' | 'manual';
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
  tutorial: {
    progressLabel: (current: number, total: number) => string;
    skipTutorial: string;
    skipStep: string;
    continuePill: string;
    steps: readonly HandsOnTutorialStepCopy[];
    recap: {
      title: string;
      body: string;
      cta: string;
    };
  };
  profile: {
    showTourAgainTitle: string;
    showTourAgainBlurb: string;
    showTourAgainButton: string;
  };
  emptyStates: Record<OnboardingTabEmptyId, OnboardingTabEmptyCopy>;
};

const TUTORIAL_STEP_COUNT = 4;

/** Plain-language onboarding copy (welcome, hands-on tutorial, tab empty states). */
export const ONBOARDING_COPY: OnboardingCopy = {
  welcome: {
    valueProp: 'Save time, money, and extra store runs — cook from what you already have.',
    benefits: [
      {
        id: 'scan',
        icon: 'camera-outline',
        title: 'Scan what you have',
        body: 'Snap pantry, fridge, or spice rack once. We remember what is in your kitchen.',
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
        body: 'Compare prices around you so you spend less on the same list.',
      },
    ],
    primaryCta: 'Get started',
    secondaryCta: 'Look around first',
  },
  tutorial: {
    progressLabel: (current, total) => `Step ${current} of ${total}`,
    skipTutorial: 'Skip tutorial',
    skipStep: 'Skip step',
    continuePill: 'Continue tutorial',
    steps: [
      {
        id: 'scan',
        icon: 'camera-outline',
        title: 'Scan what you have',
        body:
          'Start with a quick photo of your pantry, fridge, or spice rack. We turn it into ingredients you can cook from.',
        primaryCta: 'Scan an item now',
        secondaryCta: 'Add one by hand',
        primaryHref: '/pantry',
        primaryPantryAction: 'scan',
      },
      {
        id: 'recipes',
        icon: 'restaurant-outline',
        title: 'See recipes that fit',
        body: 'Recipes are ranked by what is already in your kitchen. Open one you like or add it to Meals to make.',
        primaryCta: 'See my recipes',
        primaryHref: '/recipes',
      },
      {
        id: 'grocery',
        icon: 'cart-outline',
        title: 'Your grocery list fills itself',
        body: 'When a recipe needs something you do not have, it lands on your grocery list automatically.',
        primaryCta: 'Open my list',
        primaryHref: '/grocery',
      },
      {
        id: 'shop',
        icon: 'storefront-outline',
        title: 'Compare nearby stores',
        body: 'Smart Shop totals your open list at stores near you so you can pick the cheapest run.',
        primaryCta: 'Compare stores',
        primaryHref: '/smart-shop',
      },
    ],
    recap: {
      title: 'You are set',
      body: 'Scan → recipes → list → Smart Shop. Come back any time from Profile to replay this tour.',
      cta: 'Start cooking',
    },
  },
  profile: {
    showTourAgainTitle: 'App tutorial',
    showTourAgainBlurb: 'Replay the hands-on walkthrough: scan, recipes, grocery list, and Smart Shop.',
    showTourAgainButton: 'Show tutorial again',
  },
  emptyStates: {
    home: {
      icon: 'home-outline',
      title: 'Your kitchen hub',
      body: 'Scan your pantry first — we will show your next step here.',
      ctaLabel: 'Scan pantry',
      href: '/pantry',
    },
    pantry: {
      icon: 'camera-outline',
      title: 'Your pantry is empty',
      body: 'Scan a shelf or add a few items so we know what you can cook.',
      ctaLabel: 'Scan pantry',
      href: '/pantry',
    },
    recipes: {
      icon: 'restaurant-outline',
      title: 'Add your pantry to see recipes',
      body: 'We match meals to what you already have — start with a quick scan.',
      ctaLabel: 'Go to Pantry',
      href: '/pantry',
    },
    grocery: {
      icon: 'cart-outline',
      title: 'Nothing on your list yet',
      body: 'Pick a recipe or add missing items from your pantry — we build the list for you.',
      ctaLabel: 'Browse recipes',
      href: '/recipes',
    },
  },
};

export const HANDS_ON_TUTORIAL_STEP_COUNT = TUTORIAL_STEP_COUNT;
