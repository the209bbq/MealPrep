import { MEAL_CALENDAR } from '../../config/mealCalendar';
import type { MealSlot } from '../../types/mealprep';
import { googleCalendarEventTimes } from './googleCalendar';

export interface IcsEventInput {
  uid: string;
  title: string;
  isoDate: string;
  mealSlot: MealSlot | null;
  description?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function wallClockDate(isoDate: string, hour: number, minute: number): Date {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

function formatIcsLocal(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  );
}

export function buildIcsEvent(input: IcsEventInput): string {
  const slot = input.mealSlot ?? 'dinner';
  const { hour, minute, durationMinutes } = MEAL_CALENDAR.slotDefaultTimes[slot];
  const startDate = wallClockDate(input.isoDate, hour, minute);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${formatIcsLocal(new Date())}`,
    `DTSTART:${formatIcsLocal(startDate)}`,
    `DTEND:${formatIcsLocal(endDate)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description.trim())}`);
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function buildIcsCalendar(events: IcsEventInput[]): string {
  const body = events.map((event) => buildIcsEvent(event)).join('\r\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${MEAL_CALENDAR.ics.prodId}`, body, 'END:VCALENDAR'].join(
    '\r\n',
  );
}
