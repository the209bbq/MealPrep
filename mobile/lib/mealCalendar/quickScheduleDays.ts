import { addLocalDays, localDateString } from './dates';

export interface QuickScheduleDayOption {
  isoDate: string;
  label: string;
}

const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

/** Today, Tomorrow, then the next five days with labels like "Tue Oct 6". */
export function quickScheduleDayOptions(todayIso = localDateString()): QuickScheduleDayOption[] {
  const options: QuickScheduleDayOption[] = [
    { isoDate: todayIso, label: 'Today' },
    { isoDate: addLocalDays(todayIso, 1), label: 'Tomorrow' },
  ];
  for (let offset = 2; offset < 7; offset += 1) {
    const isoDate = addLocalDays(todayIso, offset);
    const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
    const date = new Date(y, m - 1, d);
    const weekday = weekdayFormatter.format(date);
    const monthDay = monthDayFormatter.format(date);
    options.push({ isoDate, label: `${weekday} ${monthDay}` });
  }
  return options;
}
