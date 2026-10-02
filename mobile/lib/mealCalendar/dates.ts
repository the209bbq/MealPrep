import { localDateString } from '../communityDeals/localDate';

export { localDateString };

export interface CalendarDay {
  isoDate: string;
  weekdayLabel: string;
  monthDayLabel: string;
}

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(y, m - 1, d);
}

export function addLocalDays(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

/** Inclusive range of `count` local days starting at `startIso` (defaults to today). */
export function buildLocalDayRange(count: number, startIso = localDateString()): CalendarDay[] {
  const days: CalendarDay[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const isoDate = addLocalDays(startIso, offset);
    const date = parseLocalDate(isoDate);
    days.push({
      isoDate,
      weekdayLabel: weekdayFormatter.format(date),
      monthDayLabel: monthDayFormatter.format(date),
    });
  }
  return days;
}

export function isIsoDateInRange(isoDate: string, startIso: string, endIso: string): boolean {
  return isoDate >= startIso && isoDate <= endIso;
}

export function monthMatrix(year: number, monthIndex: number): (string | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(localDateString(new Date(year, monthIndex, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
