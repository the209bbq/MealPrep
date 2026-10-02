import type { MealPlanItem } from '../../types/mealprep';
import { addLocalDays } from './dates';

export function leftoverMealTitle(sourceTitle: string): string {
  const base = sourceTitle.replace(/^Leftovers:\s*/i, '').trim();
  return `Leftovers: ${base || sourceTitle}`;
}

export function buildLinkedLeftoverEntry(parent: MealPlanItem): Omit<MealPlanItem, 'id'> {
  if (!parent.scheduledOn) {
    throw new Error('Leftovers require a scheduled cook date');
  }
  return {
    recipeSlug: null,
    recipeApiId: null,
    title: leftoverMealTitle(parent.title),
    imageUrl: parent.imageUrl,
    made: false,
    madeAt: null,
    addedAt: new Date().toISOString(),
    scheduledOn: addLocalDays(parent.scheduledOn, 1),
    mealSlot: 'lunch',
    leftoverOfId: parent.id,
    linkedLeftoverId: null,
  };
}

export function applyMealPlanRemoval(mealPlan: MealPlanItem[], id: string): MealPlanItem[] {
  const target = mealPlan.find((row) => row.id === id);
  if (!target) return mealPlan;

  const removeIds = new Set<string>([id]);
  if (target.linkedLeftoverId) removeIds.add(target.linkedLeftoverId);

  let next = mealPlan.filter((row) => !removeIds.has(row.id));

  if (target.leftoverOfId) {
    next = next.map((row) =>
      row.id === target.leftoverOfId ? { ...row, linkedLeftoverId: null } : row,
    );
  }

  return next;
}

export function idsRemovedByMealPlanDelete(mealPlan: MealPlanItem[], id: string): string[] {
  const target = mealPlan.find((row) => row.id === id);
  if (!target) return [id];
  if (target.linkedLeftoverId) return [id, target.linkedLeftoverId];
  return [id];
}
