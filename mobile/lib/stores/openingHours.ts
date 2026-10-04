const DAY_INDEX: Record<string, number> = {
  mo: 0,
  tu: 1,
  we: 2,
  th: 3,
  fr: 4,
  sa: 5,
  su: 6,
};

function parseTimeToMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function dayMatches(ruleDays: string, dayIndex: number): boolean {
  const token = ruleDays.trim().toLowerCase();
  if (token === 'mo-su') return true;
  if (token.includes(',')) {
    return token.split(',').some((part) => dayMatches(part.trim(), dayIndex));
  }
  if (token.includes('-')) {
    const [start, end] = token.split('-');
    const startIdx = DAY_INDEX[start.slice(0, 2)];
    const endIdx = DAY_INDEX[end.slice(0, 2)];
    if (startIdx == null || endIdx == null) return false;
    if (startIdx <= endIdx) return dayIndex >= startIdx && dayIndex <= endIdx;
    return dayIndex >= startIdx || dayIndex <= endIdx;
  }
  const single = DAY_INDEX[token.slice(0, 2)];
  return single === dayIndex;
}

/** Best-effort open-now from OSM `opening_hours` (undefined when unknown). */
export function resolveOpenNowFromOsmHours(openingHours: string | undefined, now = new Date()): boolean | undefined {
  if (!openingHours?.trim()) return undefined;
  const normalized = openingHours.trim().toLowerCase();
  if (normalized === '24/7' || normalized === '24 hours' || normalized === 'open 24 hours') return true;

  const dayIndex = (now.getDay() + 6) % 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const rules = openingHours.split(';').map((r) => r.trim()).filter(Boolean);
  for (const rule of rules) {
    const match = /^([\w,-]+)\s+([\d:,]+)(?:-([\d:,]+))?$/i.exec(rule);
    if (!match) continue;
    const [, days, openRaw, closeRaw] = match;
    if (!days || !openRaw) continue;
    if (!dayMatches(days, dayIndex)) continue;

    const openMinutes = parseTimeToMinutes(openRaw.split(',')[0] ?? openRaw);
    const closeMinutes = closeRaw ? parseTimeToMinutes(closeRaw.split(',')[0] ?? closeRaw) : undefined;
    if (openMinutes == null) continue;

    if (closeMinutes == null) {
      if (nowMinutes >= openMinutes) return true;
      continue;
    }

    if (closeMinutes > openMinutes) {
      if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) return true;
    } else {
      if (nowMinutes >= openMinutes || nowMinutes < closeMinutes) return true;
    }
    return false;
  }

  return undefined;
}
