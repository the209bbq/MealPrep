import { Pressable, Text, type GestureResponderEvent } from 'react-native';
import { SEAMLESS_FLOW_COPY } from '../../config/seamlessFlow';
import { useScheduleRecipeSheet } from '../../context/ScheduleRecipeSheetContext';
import type { ScheduleRecipeTarget } from '../../lib/mealCalendar/scheduleTarget';

interface CookThisButtonProps {
  target?: ScheduleRecipeTarget;
  onPress?: () => void;
  className?: string;
  compact?: boolean;
  onBeforeOpen?: () => void;
}

export function CookThisButton({
  target,
  onPress,
  className = '',
  compact = false,
  onBeforeOpen,
}: CookThisButtonProps) {
  const { openScheduleRecipe } = useScheduleRecipeSheet();

  function handlePress(event: GestureResponderEvent): void {
    event.stopPropagation?.();
    onBeforeOpen?.();
    if (onPress) {
      onPress();
      return;
    }
    if (target) openScheduleRecipe(target);
  }

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={SEAMLESS_FLOW_COPY.cookThisAccessibility}
        className={`rounded-full bg-primary px-3 py-1.5 ${className}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        <Text className="text-xs font-bold text-on-primary">{SEAMLESS_FLOW_COPY.cookThis}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={SEAMLESS_FLOW_COPY.cookThisAccessibility}
      className={`min-h-[48px] items-center justify-center rounded-2xl bg-primary px-4 ${className}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      <Text className="text-base font-bold text-on-primary">{SEAMLESS_FLOW_COPY.cookThis}</Text>
    </Pressable>
  );
}
