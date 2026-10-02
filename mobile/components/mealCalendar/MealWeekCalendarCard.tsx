import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '../Card';
import { AddMealPickerSheet } from './AddMealPickerSheet';
import { MealCalendarMonthModal } from './MealCalendarMonthModal';
import { MealPlanScheduledItemMenu } from './MealPlanScheduledItemMenu';
import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { GUEST_OWNER_ID } from '../../config/guestMode';
import { THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import { buildWeekIcsFromMeals, mealCalendarEventDescription } from '../../lib/mealCalendar/exportMeal';
import { groupMealsByDay, nextMealSlotForDate } from '../../lib/mealCalendar/groupMeals';
import { buildGoogleCalendarTemplateUrl, cookEventTitle } from '../../lib/mealCalendar/googleCalendar';
import { addLocalDays, localDateString } from '../../lib/mealCalendar/dates';
import { shareOrDownloadIcs } from '../../lib/mealCalendar/shareIcs';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';
import { resolveMealPlanRecipeId } from '../../lib/mealPlan/resolve';
import type { MealPlanItem, MealSlot } from '../../types/mealprep';

function openRecipeFromMeal(item: MealPlanItem, recipeId: string | null): void {
  if (recipeId?.startsWith('recipeapi-')) {
    const apiId = Number.parseInt(recipeId.replace(/^recipeapi-(\d+).*/, '$1'), 10);
    if (Number.isFinite(apiId)) {
      router.push(`/discover-recipes/${apiId}`);
      return;
    }
  }
  if (recipeId) {
    router.push({ pathname: '/recipes', params: { recipeId } });
    return;
  }
  if (item.recipeApiId != null) {
    router.push(`/discover-recipes/${item.recipeApiId}`);
    return;
  }
  router.push('/recipes');
}

export function MealWeekCalendarCard() {
  const {
    mealPlan,
    recipes,
    session,
    profile,
    demoMode,
    pantryRecipeMatches,
    scheduleMealFromRecipe,
    updateMealPlanSchedule,
    removeMealPlanItem,
    shopForWeekScheduledMeals,
  } = useApp();

  const ownerId = session?.user?.id ?? profile.id ?? (demoMode ? 'demo-user' : GUEST_OWNER_ID);
  const today = localDateString();
  const grouped = useMemo(
    () => groupMealsByDay(mealPlan, MEAL_CALENDAR.daysAhead, today),
    [mealPlan, today],
  );

  const weekMeals = useMemo(() => {
    const end = addLocalDays(today, MEAL_CALENDAR.daysAhead - 1);
    return mealPlan.filter(
      (item) =>
        item.scheduledOn &&
        !item.made &&
        item.scheduledOn >= today &&
        item.scheduledOn <= end,
    );
  }, [mealPlan, today]);

  const exportContexts = useMemo(() => {
    const map = new Map<string, { recipeId: string | null; missingIngredientNames: string[] }>();
    for (const item of weekMeals) {
      const recipeId = resolveMealPlanRecipeId(item, recipes, ownerId);
      const missing =
        recipeId != null
          ? (pantryRecipeMatches.byRecipeId.get(recipeId)?.missing.map((row) => row.name) ?? [])
          : [];
      map.set(item.id, { recipeId, missingIngredientNames: missing });
    }
    return map;
  }, [ownerId, pantryRecipeMatches.byRecipeId, recipes, weekMeals]);

  const [monthOpen, setMonthOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<MealPlanItem | null>(null);

  const pickerDefaultSlot: MealSlot = pickerDate
    ? nextMealSlotForDate(mealPlan, pickerDate)
    : 'dinner';

  async function exportWeekIcs(): Promise<void> {
    const body = buildWeekIcsFromMeals(weekMeals, exportContexts);
    await shareOrDownloadIcs(body);
  }

  async function addMealToGoogleCalendar(item: MealPlanItem): Promise<void> {
    if (!item.scheduledOn) return;
    const ctx = exportContexts.get(item.id) ?? { recipeId: null, missingIngredientNames: [] };
    const url = buildGoogleCalendarTemplateUrl({
      title: cookEventTitle(item.title),
      isoDate: item.scheduledOn,
      mealSlot: item.mealSlot,
      details: mealCalendarEventDescription(item, ctx),
    });
    await openExternalUrl(url);
  }

  return (
    <>
      <Card className="relative mt-4" title="This week" subtitle="Tap a meal to open the recipe">
        <View className="absolute right-4 top-4 flex-row gap-2">
          <Pressable
            onPress={() => void exportWeekIcs()}
            accessibilityLabel="Download week as calendar file"
            className="rounded-full bg-primary-light p-2"
          >
            <Ionicons name="share-outline" size={18} color={THEME.primaryDark} />
          </Pressable>
          <Pressable
            onPress={() => setMonthOpen(true)}
            accessibilityLabel="Open month calendar"
            className="rounded-full bg-primary-light p-2"
          >
            <Ionicons name="calendar-outline" size={18} color={THEME.primaryDark} />
          </Pressable>
        </View>

        {grouped.map(({ day, meals }, index) => (
          <View key={day.isoDate} className={`py-2 ${index > 0 ? 'border-t border-border' : 'mt-6'}`}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-ink">
                  {day.weekdayLabel}
                  {day.isoDate === today ? ' · Today' : ''}
                </Text>
                <Text className="text-xs text-muted">{day.monthDayLabel}</Text>
              </View>
              <Pressable
                onPress={() => setPickerDate(day.isoDate)}
                className="rounded-full border border-border px-2 py-1"
              >
                <Text className="text-xs font-bold text-primary-dark">+ Add meal</Text>
              </Pressable>
            </View>

            {meals.length === 0 ? (
              <Text className="mt-1 text-xs text-muted">Nothing scheduled</Text>
            ) : (
              meals.map((item) => {
                const slotLabel = item.mealSlot ? MEAL_CALENDAR.slotLabels[item.mealSlot] : null;
                return (
                  <View key={item.id} className="mt-2 flex-row items-center">
                    <Pressable
                      onPress={() => {
                        const recipeId = resolveMealPlanRecipeId(item, recipes, ownerId);
                        openRecipeFromMeal(item, recipeId);
                      }}
                      onLongPress={() => setMenuItem(item)}
                      className="min-h-[36px] flex-1 justify-center rounded-xl bg-paper px-3 py-2"
                    >
                      <Text className="font-semibold text-ink" numberOfLines={2}>
                        {item.title}
                      </Text>
                      {slotLabel ? <Text className="text-xs text-muted">{slotLabel}</Text> : null}
                    </Pressable>
                    <Pressable onPress={() => setMenuItem(item)} className="ml-2 p-1">
                      <Ionicons name="ellipsis-horizontal" size={18} color={THEME.muted} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        ))}

        <Pressable
          onPress={shopForWeekScheduledMeals}
          className="mt-3 items-center rounded-xl bg-primary py-3"
        >
          <Text className="text-sm font-bold text-onPrimary">{MEAL_CALENDAR.shopForWeekLabel}</Text>
        </Pressable>
      </Card>

      <MealCalendarMonthModal
        visible={monthOpen}
        mealPlan={mealPlan}
        onClose={() => setMonthOpen(false)}
        onSelectDate={(isoDate) => setPickerDate(isoDate)}
      />

      <AddMealPickerSheet
        visible={pickerDate != null}
        isoDate={pickerDate ?? today}
        defaultSlot={pickerDefaultSlot}
        recipes={recipes}
        pantryMatches={pantryRecipeMatches}
        onClose={() => setPickerDate(null)}
        onPick={(input) =>
          void scheduleMealFromRecipe({
            ...input,
            scheduledOn: pickerDate ?? today,
          })
        }
      />

      <MealPlanScheduledItemMenu
        visible={menuItem != null}
        item={menuItem}
        onClose={() => setMenuItem(null)}
        onRemove={() => {
          if (menuItem) void removeMealPlanItem(menuItem.id);
          setMenuItem(null);
        }}
        onUnschedule={() => {
          if (menuItem) void updateMealPlanSchedule(menuItem.id, { scheduledOn: null, mealSlot: null });
          setMenuItem(null);
        }}
        onMoveToDate={(isoDate) => {
          if (menuItem) {
            void updateMealPlanSchedule(menuItem.id, {
              scheduledOn: isoDate,
              mealSlot: menuItem.mealSlot ?? nextMealSlotForDate(mealPlan, isoDate),
            });
          }
        }}
        onAddToGoogleCalendar={() => {
          if (menuItem) void addMealToGoogleCalendar(menuItem);
          setMenuItem(null);
        }}
      />
    </>
  );
}
