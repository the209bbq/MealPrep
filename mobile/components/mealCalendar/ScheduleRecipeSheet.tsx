import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { useApp } from '../../context/AppContext';
import { localDateString } from '../../lib/mealCalendar/dates';
import { quickScheduleDayOptions } from '../../lib/mealCalendar/quickScheduleDays';
import type { ScheduleRecipeTarget } from '../../lib/mealCalendar/scheduleTarget';
import { MEAL_SLOTS, type MealSlot } from '../../types/mealprep';
import { MealCalendarMonthModal } from './MealCalendarMonthModal';

interface ScheduleRecipeSheetProps {
  visible: boolean;
  target: ScheduleRecipeTarget | null;
  onClose: () => void;
}

function ScheduleRecipeSheetForm({
  target,
  onClose,
  today,
}: {
  target: ScheduleRecipeTarget;
  onClose: () => void;
  today: string;
}) {
  const { mealPlan, scheduleMealFromRecipe, notifyMealScheduled } = useApp();
  const dayOptions = useMemo(() => quickScheduleDayOptions(today), [today]);
  const [selectedDay, setSelectedDay] = useState(today);
  const [makesLeftovers, setMakesLeftovers] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);

  async function saveSlot(mealSlot: MealSlot): Promise<void> {
    const result = await scheduleMealFromRecipe({
      recipeId: target.recipeSlug ?? String(target.recipeApiId ?? target.title),
      recipeSlug: target.recipeSlug,
      recipeApiId: target.recipeApiId,
      title: target.title,
      imageUrl: target.imageUrl,
      scheduledOn: selectedDay,
      mealSlot,
      makesLeftovers,
    });
    notifyMealScheduled(result, selectedDay, mealSlot);
    onClose();
  }

  return (
    <>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="max-h-[85%] rounded-t-3xl bg-card px-4 pb-8 pt-4" onPress={() => undefined}>
          <Text className="text-lg font-bold text-ink">Add to calendar</Text>
          <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
            {target.title}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
            {dayOptions.map((day) => (
              <Pressable
                key={day.isoDate}
                onPress={() => setSelectedDay(day.isoDate)}
                className={`mr-2 rounded-full px-3 py-2 ${
                  selectedDay === day.isoDate ? 'bg-primary' : 'bg-primary-light'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedDay === day.isoDate ? 'text-onPrimary' : 'text-primary-dark'
                  }`}
                >
                  {day.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => setMonthOpen(true)}
            className="mt-3 self-start rounded-full border border-border px-3 py-1.5"
          >
            <Text className="text-xs font-bold text-primary-dark">Pick date</Text>
          </Pressable>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {MEAL_SLOTS.map((slot) => (
              <Pressable
                key={slot}
                onPress={() => void saveSlot(slot)}
                className="rounded-full border border-border bg-paper px-3 py-2"
              >
                <Text className="text-xs font-bold text-ink">{MEAL_CALENDAR.slotLabels[slot]}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => setMakesLeftovers((prev) => !prev)}
            className="mt-4 flex-row items-center justify-between rounded-xl border border-border px-3 py-2"
          >
            <Text className="text-sm font-semibold text-ink">{MEAL_CALENDAR.makesLeftoversLabel}</Text>
            <Text className="text-xs font-bold text-primary-dark">{makesLeftovers ? 'On' : 'Off'}</Text>
          </Pressable>

          <Pressable onPress={onClose} className="mt-4 items-center rounded-xl border border-border py-3">
            <Text className="font-bold text-muted">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>

      <MealCalendarMonthModal
        visible={monthOpen}
        mealPlan={mealPlan}
        onClose={() => setMonthOpen(false)}
        onSelectDate={(isoDate) => {
          setSelectedDay(isoDate);
          setMonthOpen(false);
        }}
      />
    </>
  );
}

export function ScheduleRecipeSheet({ visible, target, onClose }: ScheduleRecipeSheetProps) {
  const today = localDateString();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {visible && target ? (
        <ScheduleRecipeSheetForm key={`${target.title}-${today}`} target={target} onClose={onClose} today={today} />
      ) : null}
    </Modal>
  );
}
