/** Calendar date in the device local timezone (`YYYY-MM-DD`). */
export function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a date-only ISO string in the local timezone (not UTC midnight). */
export function parseLocalDateOnly(isoDate: string): Date {
  const trimmed = isoDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return new Date(trimmed);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

export function isPastLocalDate(isoDate: string, today = localDateString()): boolean {
  const trimmed = isoDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed < today;
  }
  return parseLocalDateOnly(trimmed).getTime() < parseLocalDateOnly(today).getTime();
}
