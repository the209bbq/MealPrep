import type { GroceryListItem } from '../../types/mealprep';
import { isGroceryManualLineDismissed } from './dismissals';
import { isGroceryOriginPinned } from './origin';
import { isManualGroceryItem } from '../grocery';

/** Rows that must survive a meal-plan grocery rebuild (manual only — plan lines are recomputed). */
export function pinnedGroceryForMealPlanRebuild(
  previous: GroceryListItem[],
  dismissals: Set<string>,
): GroceryListItem[] {
  return previous.filter(
    (item) =>
      isManualGroceryItem(item) && !isGroceryManualLineDismissed(dismissals, item.name, item.unit),
  );
}

/** Rows that survive rebuild when there is no active meal-plan grocery pass. */
export function pinnedGroceryWithoutMealPlan(
  previous: GroceryListItem[],
  dismissals: Set<string>,
): GroceryListItem[] {
  return previous.filter(
    (item) =>
      isGroceryOriginPinned(item.origin) &&
      !isGroceryManualLineDismissed(dismissals, item.name, item.unit),
  );
}
