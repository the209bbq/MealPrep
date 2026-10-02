import { MEAL_CALENDAR } from '../../config/mealCalendar';
import type { MealSlot } from '../../types/mealprep';
import { localDateString } from './dates';

export interface GoogleCalendarEventInput {
  title: string;
  isoDate: string;
  mealSlot: MealSlot | null;
  details?: string;
  location?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatGoogleDateTime(isoDate: string, hour: number, minute: number): string {
  const [y, m, d] = isoDate.split('-');
  return `${y}${m}${d}T${pad2(hour)}${pad2(minute)}00`;
}

export function googleCalendarEventTimes(isoDate: string, mealSlot: MealSlot | null): {
  start: string;
  end: string;
} {
  const slot = mealSlot ?? 'dinner';
  const { hour, minute, durationMinutes } = MEAL_CALENDAR.slotDefaultTimes[slot];
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  const startDate = new Date(y, m - 1, d, hour, minute, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  const startIso = localDateString(startDate);
  const endIso = localDateString(endDate);
  return {
    start: formatGoogleDateTime(startIso, startDate.getHours(), startDate.getMinutes()),
    end: formatGoogleDateTime(endIso, endDate.getHours(), endDate.getMinutes()),
  };
}

export function buildGoogleCalendarTemplateUrl(input: GoogleCalendarEventInput): string {
  const { templateBaseUrl } = MEAL_CALENDAR.googleCalendar;
  const { start, end } = googleCalendarEventTimes(input.isoDate, input.mealSlot);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${start}/${end}`,
  });
  if (input.details?.trim()) params.set('details', input.details.trim());
  if (input.location?.trim()) params.set('location', input.location.trim());
  return `${templateBaseUrl}?${params.toString()}`;
}

export function cookEventTitle(recipeTitle: string): string {
  return `Cook: ${recipeTitle}`;
}
