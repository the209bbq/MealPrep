import { localDateString } from './dates';
import { quickScheduleDayOptions } from './quickScheduleDays';

/** Friendly date for meal picker headers, e.g. "Tue, Oct 13" or "Today". */
export function formatMealPickerHeaderDate(isoDate: string, todayIso = localDateString()): string {
  const quick = quickScheduleDayOptions(todayIso).find((row) => row.isoDate === isoDate);
  if (quick) {
    if (quick.label === 'Today' || quick.label === 'Tomorrow') return quick.label;
    const commaIdx = quick.label.indexOf(' ');
    if (commaIdx > 0) {
      const weekday = quick.label.slice(0, commaIdx);
      const rest = quick.label.slice(commaIdx + 1);
      return `${weekday}, ${rest}`;
    }
    return quick.label;
  }
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(y, m - 1, d);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  const monthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  return `${weekday}, ${monthDay}`;
}
