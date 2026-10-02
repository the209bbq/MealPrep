import { Platform, Share } from 'react-native';
import { MEAL_CALENDAR } from '../../config/mealCalendar';

export async function shareOrDownloadIcs(icsBody: string, fileName = MEAL_CALENDAR.ics.weekFileName): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({
    title: 'Meal plan week',
    message: icsBody,
  });
}
