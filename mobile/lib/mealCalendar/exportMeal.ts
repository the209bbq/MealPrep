import type { MealPlanItem } from '../../types/mealprep';
import { buildRecipeAppLink } from './appLink';
import { cookEventTitle } from './googleCalendar';
import { buildIcsCalendar, type IcsEventInput } from './ics';

export interface MealCalendarExportContext {
  recipeId: string | null;
  missingIngredientNames: string[];
}

export function mealCalendarEventDescription(
  item: MealPlanItem,
  context: MealCalendarExportContext,
): string {
  const lines: string[] = [];
  if (context.recipeId) {
    lines.push(`Open in app: ${buildRecipeAppLink(context.recipeId)}`);
  }
  if (context.missingIngredientNames.length > 0) {
    lines.push(`Missing: ${context.missingIngredientNames.join(', ')}`);
  }
  lines.push('Planned with MealPlanatic.');
  return lines.join('\n');
}

export function mealPlanItemToIcsEvent(
  item: MealPlanItem,
  context: MealCalendarExportContext,
): IcsEventInput | null {
  if (!item.scheduledOn || item.made) return null;
  return {
    uid: `${item.id}@mealplanatic`,
    title: cookEventTitle(item.title),
    isoDate: item.scheduledOn,
    mealSlot: item.mealSlot,
    description: mealCalendarEventDescription(item, context),
  };
}

export function buildWeekIcsFromMeals(
  items: MealPlanItem[],
  contexts: Map<string, MealCalendarExportContext>,
): string {
  const events: IcsEventInput[] = [];
  for (const item of items) {
    const ctx = contexts.get(item.id) ?? { recipeId: null, missingIngredientNames: [] };
    const event = mealPlanItemToIcsEvent(item, ctx);
    if (event) events.push(event);
  }
  return buildIcsCalendar(events);
}
