import { Pressable, type GestureResponderEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { THEME } from '../../config/appConfig';
import { useScheduleRecipeSheet } from '../../context/ScheduleRecipeSheetContext';
import type { ScheduleRecipeTarget } from '../../lib/mealCalendar/scheduleTarget';

interface AddToCalendarButtonProps {
  target: ScheduleRecipeTarget;
  size?: number;
  className?: string;
}

export function AddToCalendarButton({ target, size = 22, className = 'p-1.5' }: AddToCalendarButtonProps) {
  const { openScheduleRecipe } = useScheduleRecipeSheet();

  function handlePress(event: GestureResponderEvent): void {
    event.stopPropagation?.();
    openScheduleRecipe(target);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={MEAL_CALENDAR.addToCalendarAccessibilityLabel}
      accessibilityRole="button"
      className={className}
      hitSlop={6}
    >
      <MaterialCommunityIcons name="calendar-plus" size={size} color={THEME.primaryDark} />
    </Pressable>
  );
}
