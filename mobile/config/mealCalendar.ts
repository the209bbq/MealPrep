import type { MealSlot } from '../types/mealprep';

/** Home week view + calendar defaults (typed, single source of truth). */
export const MEAL_CALENDAR = {
  /** Days shown on Home starting today (local date). */
  daysAhead: 7,
  slotDefaultTimes: {
    breakfast: { hour: 8, minute: 0, durationMinutes: 45 },
    lunch: { hour: 12, minute: 30, durationMinutes: 60 },
    dinner: { hour: 18, minute: 0, durationMinutes: 75 },
  } satisfies Record<
    MealSlot,
    { hour: number; minute: number; durationMinutes: number }
  >,
  slotLabels: {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
  } satisfies Record<MealSlot, string>,
  googleCalendar: {
    templateBaseUrl: 'https://calendar.google.com/calendar/render',
    /** Future: two-way sync via Google Calendar API + OAuth (not implemented). */
    oauthSyncEnabled: false,
    oauthSyncEnvFlag: 'EXPO_PUBLIC_GOOGLE_CALENDAR_SYNC',
  },
  ics: {
    prodId: '-//MealPlanatic//Meal Calendar//EN',
    weekFileName: 'meal-plan-week.ics',
  },
  shopForWeekLabel: 'Shop for this week',
  makesLeftoversLabel: 'Makes leftovers',
  picker: {
    maxRecipes: 40,
  },
} as const;

export type MealCalendarSlotTimes = (typeof MEAL_CALENDAR)['slotDefaultTimes'][MealSlot];
