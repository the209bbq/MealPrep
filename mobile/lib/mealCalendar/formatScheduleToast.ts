import { MEAL_CALENDAR } from '../../config/mealCalendar';
import type { MealSlot } from '../../types/mealprep';

function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(y, m - 1, d);
}

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

export function formatAddedToCalendarMessage(isoDate: string, mealSlot: MealSlot): string {
  const weekday = weekdayFormatter.format(parseLocalDate(isoDate));
  const slot =
    mealSlot === 'snack'
      ? 'snack'
      : (MEAL_CALENDAR.slotLabels[mealSlot].toLowerCase() as string);
  return `Added to ${weekday} ${slot}`;
}
