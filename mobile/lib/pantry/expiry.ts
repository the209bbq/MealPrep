import type { PantryItem } from '../../types/mealprep';

/** Calendar date `YYYY-MM-DD` (UTC-safe day arithmetic). */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = parseIsoDateOnly(isoDate);
  if (!base) return isoDate;
  base.setUTCDate(base.getUTCDate() + days);
  return formatIsoDateOnly(base);
}

export function formatIsoDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayIsoDate(now = new Date()): string {
  return formatIsoDateOnly(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function parseIsoDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

/** Subtle pantry list label, e.g. "exp Oct 12". */
export function formatPantryExpiryShort(expiresOn: string | null | undefined): string | null {
  if (!expiresOn) return null;
  const parsed = parseIsoDateOnly(expiresOn.slice(0, 10));
  if (!parsed) return null;
  const label = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `exp ${label}`;
}

export function estimateExpiryFromShelfLife(shelfLifeDays: number, now = new Date()): string {
  return addDaysToIsoDate(todayIsoDate(now), shelfLifeDays);
}

/** True when `expiresOn` is on or before `now + days` (inclusive). */
export function isExpiringSoon(item: Pick<PantryItem, 'expiresOn'>, days = 7, now = new Date()): boolean {
  if (!item.expiresOn) return false;
  const exp = parseIsoDateOnly(item.expiresOn.slice(0, 10));
  if (!exp) return false;
  const today = parseIsoDateOnly(todayIsoDate(now));
  if (!today) return false;
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + days);
  return exp.getTime() <= horizon.getTime();
}
