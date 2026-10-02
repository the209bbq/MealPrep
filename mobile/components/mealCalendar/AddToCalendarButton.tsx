import { Pressable, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { THEME } from '../../config/appConfig';
import { useScheduleRecipeSheet } from '../../context/ScheduleRecipeSheetContext';
import type { ScheduleRecipeTarget } from '../../lib/mealCalendar/scheduleTarget';

interface AddToCalendarButtonProps {
  target: ScheduleRecipeTarget;
  size?: number;
  className?: string;
  /** Close overlays (e.g. recipe detail sheet) before opening the schedule sheet. */
  onBeforeOpen?: () => void;
  /** Override default schedule sheet opener (for tests / nested providers). */
  onOpenSchedule?: (target: ScheduleRecipeTarget) => void;
}

export function AddToCalendarButton({
  target,
  size = 22,
  className = 'p-1.5',
  onBeforeOpen,
  onOpenSchedule,
}: AddToCalendarButtonProps) {
  const { openScheduleRecipe } = useScheduleRecipeSheet();
  const open = onOpenSchedule ?? openScheduleRecipe;

  function handlePress(event: GestureResponderEvent): void {
    event.stopPropagation?.();
    onBeforeOpen?.();
    open(target);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={MEAL_CALENDAR.addToCalendarAccessibilityLabel}
      accessibilityRole="button"
      className={className}
      hitSlop={6}
    >
      <Ionicons name="calendar-outline" size={size} color={THEME.primaryDark} />
    </Pressable>
  );
}
