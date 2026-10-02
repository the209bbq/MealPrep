/**
 * Meal calendar regression: dates, grouping, guest merge keys, Google URL, ICS.
 * Run from mobile/: npm run test:meal-calendar
 */

import { MEAL_CALENDAR } from '../config/mealCalendar';
import { buildLocalDayRange, addLocalDays } from '../lib/mealCalendar/dates';
import { groupMealsByDay, mealsForLocalDate } from '../lib/mealCalendar/groupMeals';
import { mergeGuestMealPlanIntoAccount } from '../lib/guest/mergeGuestKitchen';
import { buildGoogleCalendarTemplateUrl, cookEventTitle, googleCalendarEventTimes } from '../lib/mealCalendar/googleCalendar';
import { buildIcsCalendar, buildIcsEvent } from '../lib/mealCalendar/ics';
import type { MealPlanItem } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function planRow(partial: Partial<MealPlanItem> & Pick<MealPlanItem, 'id' | 'title'>): MealPlanItem {
  return {
    id: partial.id,
    recipeSlug: partial.recipeSlug ?? 'lemon-chicken',
    recipeApiId: partial.recipeApiId ?? null,
    title: partial.title,
    imageUrl: null,
    made: partial.made ?? false,
    madeAt: null,
    addedAt: '2026-10-01T12:00:00.000Z',
    scheduledOn: partial.scheduledOn ?? null,
    mealSlot: partial.mealSlot ?? null,
  };
}

function main(): void {
  assert(MEAL_CALENDAR.daysAhead === 7, 'daysAhead should be 7');
  const start = '2026-10-02';
  const range = buildLocalDayRange(7, start);
  assert(range.length === 7, 'range length');
  assert(range[0].isoDate === start, 'range start');
  assert(range[6].isoDate === addLocalDays(start, 6), 'range end');

  const mealPlan = [
    planRow({ id: 'a', title: 'Dinner A', scheduledOn: start, mealSlot: 'dinner' }),
    planRow({ id: 'b', title: 'Lunch B', scheduledOn: start, mealSlot: 'lunch' }),
    planRow({ id: 'c', title: 'Queue', scheduledOn: null }),
  ];
  const grouped = groupMealsByDay(mealPlan, 7, start);
  assert(grouped[0].meals.length === 2, 'two meals on first day');
  assert(grouped[0].meals[0].title === 'Lunch B', 'lunch sorted first');
  assert(mealsForLocalDate(mealPlan, addLocalDays(start, 1)).length === 0, 'empty next day');

  const account = [planRow({ id: 'acct', title: 'Account', recipeSlug: 'tacos', scheduledOn: start, mealSlot: 'dinner' })];
  const guest = [
    planRow({ id: 'guest', title: 'Guest dinner', recipeSlug: 'tacos', scheduledOn: start, mealSlot: 'lunch' }),
    planRow({ id: 'guest2', title: 'Guest same slug unscheduled', recipeSlug: 'tacos', scheduledOn: null }),
  ];
  const merged = mergeGuestMealPlanIntoAccount(account, guest);
  assert(merged.inserts.length === 2, 'scheduled slot + unscheduled should merge as distinct');
  assert(merged.mealPlan.length === 3, 'merged meal plan size');

  const times = googleCalendarEventTimes(start, 'breakfast');
  assert(times.start.includes('T080000'), 'breakfast start time');
  const url = buildGoogleCalendarTemplateUrl({
    title: cookEventTitle('Test'),
    isoDate: start,
    mealSlot: 'breakfast',
    details: 'Line one',
  });
  assert(url.includes('calendar.google.com'), 'google host');
  assert(url.includes('text=Cook'), 'title param');
  assert(url.includes('dates='), 'dates param');

  const ics = buildIcsCalendar([
    {
      uid: 'test@mealplanatic',
      title: cookEventTitle('ICS meal'),
      isoDate: start,
      mealSlot: 'dinner',
      description: 'Details',
    },
  ]);
  assert(ics.includes('BEGIN:VCALENDAR'), 'ics calendar');
  assert(ics.includes('BEGIN:VEVENT'), 'ics event');
  assert(buildIcsEvent({
    uid: 'x@mealplanatic',
    title: 'Cook: X',
    isoDate: start,
    mealSlot: 'lunch',
  }).includes('SUMMARY:Cook: X'), 'ics summary');

  console.log('OK meal-calendar regression');
}

main();
