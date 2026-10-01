import { filterDefaultKitchenMatches, topDefaultKitchenMatch } from '../../config/recipeMatching';
import type { RecipePantryMatch } from '../recipeMatch';

export type HomeNextStepKind = 'scan_pantry' | 'shop_list' | 'add_missing' | 'cook_recipe' | 'build_pantry';

export interface HomeNextStep {
  kind: HomeNextStepKind;
  title: string;
  body: string;
  ctaLabel: string;
  recipeId?: string;
  recipeName?: string;
  openGroceryCount?: number;
}

export function resolveHomeNextStep(input: {
  pantryItemCount: number;
  openGroceryCount: number;
  rankedMatches: RecipePantryMatch[];
}): HomeNextStep {
  const { pantryItemCount, openGroceryCount, rankedMatches } = input;

  if (pantryItemCount === 0) {
    return {
      kind: 'scan_pantry',
      title: 'Stock your pantry first',
      body: 'Scan shelves once — we match recipes to what you already have so you cook instead of guessing.',
      ctaLabel: 'Scan pantry',
    };
  }

  if (openGroceryCount > 0) {
    return {
      kind: 'shop_list',
      title: 'Compare prices on your list',
      body: `${openGroceryCount} item${openGroceryCount === 1 ? '' : 's'} to buy. Smart Shop finds the cheapest run so you save money and time.`,
      ctaLabel: 'Shop this list',
      openGroceryCount,
    };
  }

  const top = topDefaultKitchenMatch(rankedMatches, pantryItemCount);
  if (top && top.missingCount > 0) {
    return {
      kind: 'add_missing',
      title: `Almost ready: ${top.recipeName}`,
      body: `${top.missingCount} ingredient${top.missingCount === 1 ? '' : 's'} still missing. Add them to your grocery list in one tap.`,
      ctaLabel: 'Add missing to list',
      recipeId: top.recipeId,
      recipeName: top.recipeName,
    };
  }

  if (top) {
    return {
      kind: 'cook_recipe',
      title: `Cook ${top.recipeName}`,
      body: `${top.percentMatch}% of ingredients on hand — start here to save a trip and use what you bought.`,
      ctaLabel: 'Open recipe',
      recipeId: top.recipeId,
      recipeName: top.recipeName,
    };
  }

  return {
    kind: 'build_pantry',
    title: 'Add a few more staples',
    body: 'Scan or add ingredients so we can suggest meals that match what you have (50%+ overlap).',
    ctaLabel: 'Update pantry',
  };
}
