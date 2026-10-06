import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { SEAMLESS_FLOW_COPY } from '../../config/seamlessFlow';
import { useApp } from '../../context/AppContext';
import {
  appendRecipeEngagementEvent,
  createSeamlessEngagementEvent,
} from '../../lib/recipeRanking';
import { formatIngredientText, formatQuantityWithUnit } from '../../lib/formatQuantity';
import { localDateString } from '../../lib/mealCalendar/dates';
import { quickScheduleDayOptions } from '../../lib/mealCalendar/quickScheduleDays';
import {
  categoryGroupForTarget,
  type ScheduleRecipeTarget,
} from '../../lib/mealCalendar/scheduleTarget';
import { pickSwapPantryMatch } from '../../lib/seamlessFlow/swapSuggestion';
import { suggestDaySlot, takenSlotCodesForDay } from '../../lib/seamlessFlow/suggestDaySlot';
import { SEAMLESS_PLAN_SLOTS } from '../../lib/seamlessFlow/planSlots';
import { mealSlotToPlanCode } from '../../lib/seamlessFlow/planSlots';
import type { MealSlot } from '../../types/mealprep';
import { MealCalendarMonthModal } from './MealCalendarMonthModal';
import { RecipeThumbnail } from '../recipes/RecipeThumbnail';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { GUEST_OWNER_ID } from '../../config/guestMode';

type SheetStep = 'choose' | 'cook_missing' | 'plan';

interface ScheduleRecipeSheetProps {
  visible: boolean;
  target: ScheduleRecipeTarget | null;
  onClose: () => void;
}

function PrimaryActionButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`min-h-[52px] items-center justify-center rounded-2xl px-4 ${
        primary ? 'bg-primary' : 'border border-border bg-paper'
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      <Text className={`text-base font-bold ${primary ? 'text-on-primary' : 'text-ink'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function ScheduleRecipeSheetBody({
  target,
  onClose,
  today,
}: {
  target: ScheduleRecipeTarget;
  onClose: () => void;
  today: string;
}) {
  const {
    mealPlan,
    scheduleMealFromRecipe,
    addMissingRecipeIngredientsToGrocery,
    appendMissingIngredientsForPlannedMeal,
    pantryRecipeMatchesRankedFiltered,
    pantryRecipeMatches,
    profile,
    session,
    demoMode,
    notifyMealScheduled,
    removeMealPlanItem,
  } = useApp();

  const ownerId = session?.user?.id ?? profile.id ?? (demoMode ? 'demo-user' : GUEST_OWNER_ID);

  const logSeamlessEvent = useCallback(
    (
      refKey: string,
      type: 'plan' | 'cook_now' | 'just_save' | 'skip',
      v2: Parameters<typeof createSeamlessEngagementEvent>[2],
    ) => {
      appendRecipeEngagementEvent(
        ownerId,
        createSeamlessEngagementEvent(refKey, type, v2),
      );
    },
    [ownerId],
  );

  const sheetId = target.sheetId ?? 'sheet-unknown';
  const group = useMemo(() => categoryGroupForTarget(target), [target]);
  const match =
    target.match ??
    pantryRecipeMatches.byRecipeId.get(target.pantryRecipeId) ??
    null;
  const missing = match?.missing ?? [];

  const [step, setStep] = useState<SheetStep>('choose');
  const [monthOpen, setMonthOpen] = useState(false);
  const settledRef = useRef(false);

  const defaultPlan = useMemo(
    () =>
      suggestDaySlot({
        category: target.categoryLabel,
        title: target.title,
        tags: target.tags,
        mealPlan,
        todayIso: today,
      }),
    [mealPlan, target, today],
  );

  const [selectedDay, setSelectedDay] = useState(defaultPlan.day);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>(defaultPlan.slot);

  useEffect(() => {
    setSelectedDay(defaultPlan.day);
    setSelectedSlot(defaultPlan.slot);
  }, [defaultPlan.day, defaultPlan.slot, target.pantryRecipeId]);

  const dayOptions = useMemo(() => quickScheduleDayOptions(today), [today]);

  const logBase = useCallback(() => {
    return {
      ts: Date.now(),
      recipeId: target.pantryRecipeId,
      source: target.source,
      group,
      sheetId,
    };
  }, [group, sheetId, target]);

  const markSettled = useCallback(() => {
    settledRef.current = true;
  }, []);

  const handleDismiss = useCallback(() => {
    if (!settledRef.current) {
      logSeamlessEvent(target.refKey, 'skip', logBase());
    }
    onClose();
  }, [logBase, logSeamlessEvent, onClose, target.refKey]);

  const openCookView = useCallback(() => {
    markSettled();
    target.onOpenCookView?.();
    onClose();
  }, [markSettled, onClose, target]);

  const confirmPlan = useCallback(
    async (day: string, slot: MealSlot) => {
      markSettled();
      const slotCode = mealSlotToPlanCode(slot);
      logSeamlessEvent(target.refKey, 'plan', {
        ...logBase(),
        day,
        slot: slotCode ?? 'D',
        ghostShown: false,
      });

      const result = await scheduleMealFromRecipe({
        recipeId: target.pantryRecipeId,
        recipeSlug: target.recipeSlug,
        recipeApiId: target.recipeApiId,
        title: target.title,
        imageUrl: target.imageUrl,
        scheduledOn: day,
        mealSlot: slot,
      });

      const link = {
        mealPlanItemId: result.parentId,
        scheduledOn: day,
        mealSlot: slot,
        mealTitle: target.title,
      };
      appendMissingIngredientsForPlannedMeal(target.pantryRecipeId, missing, link);

      notifyMealScheduled(result, day, slot);
      onClose();
    },
    [
      appendMissingIngredientsForPlannedMeal,
      logBase,
      logSeamlessEvent,
      markSettled,
      missing,
      onClose,
      notifyMealScheduled,
      scheduleMealFromRecipe,
      target,
    ],
  );

  const startCookNow = useCallback(() => {
    logSeamlessEvent(target.refKey, 'cook_now', {
      ...logBase(),
      missingCount: missing.length,
    });
    if (missing.length === 0) {
      openCookView();
      return;
    }
    setStep('cook_missing');
  }, [logBase, logSeamlessEvent, missing.length, openCookView, target.refKey]);

  const swapMatch = useMemo(
    () => pickSwapPantryMatch(pantryRecipeMatchesRankedFiltered, target.pantryRecipeId),
    [pantryRecipeMatchesRankedFiltered, target.pantryRecipeId],
  );

  const heroUri = target.imageUrl;

  if (step === 'cook_missing') {
    const preview = missing.slice(0, 6);
    return (
      <>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={handleDismiss}>
          <Pressable className="max-h-[85%] rounded-t-3xl bg-card px-4 pb-8 pt-4" onPress={() => undefined}>
            <Text className="text-lg font-bold text-ink">{SEAMLESS_FLOW_COPY.missingHeading(missing.length)}</Text>
            <Text className="mt-1 text-sm text-muted" numberOfLines={2}>{target.title}</Text>
            <ScrollView className="mt-3 max-h-40">
              {preview.map((ing) => (
                <Text key={`${ing.ingredientId}-${ing.name}`} className="mt-1 text-sm text-ink">
                  · {formatIngredientText(ing.name)}
                  {ing.quantity > 0 ? ` — ${formatQuantityWithUnit(ing.quantity, ing.unit)}` : ''}
                </Text>
              ))}
            </ScrollView>
            <View className="mt-4 gap-2">
              <PrimaryActionButton
                label={SEAMLESS_FLOW_COPY.grabIt}
                onPress={() => {
                  markSettled();
                  addMissingRecipeIngredientsToGrocery(target.pantryRecipeId);
                  openCookView();
                }}
              />
              {swapMatch ? (
                <PrimaryActionButton
                  variant="secondary"
                  label={SEAMLESS_FLOW_COPY.swapSuggestion(swapMatch.recipeName)}
                  onPress={() => {
                    markSettled();
                    onClose();
                    target.onOpenSwapRecipe?.(swapMatch.recipeId);
                  }}
                />
              ) : null}
            </View>
            <Pressable onPress={() => openCookView()} className="mt-3 items-center py-2">
              <Text className="text-sm font-semibold text-primary-dark">Continue anyway</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </>
    );
  }

  if (step === 'plan') {
    return (
      <>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={handleDismiss}>
          <Pressable className="max-h-[90%] rounded-t-3xl bg-card px-4 pb-8 pt-4" onPress={() => undefined}>
            <Text className="text-lg font-bold text-ink">{SEAMLESS_FLOW_COPY.planIt}</Text>
            <Text className="mt-1 text-sm text-muted" numberOfLines={2}>{target.title}</Text>

            <View className="mt-4 flex-row gap-2">
              {SEAMLESS_PLAN_SLOTS.map((slot) => {
                const selected = selectedSlot === slot;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => setSelectedSlot(slot)}
                    className={`flex-1 items-center rounded-full py-2 ${
                      selected ? 'bg-primary' : 'bg-primary-light'
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  >
                    <Text
                      className={`text-xs font-bold ${selected ? 'text-on-primary' : 'text-primary-dark'}`}
                    >
                      {MEAL_CALENDAR.slotLabels[slot]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
              {dayOptions.map((day) => {
                const selected = selectedDay === day.isoDate;
                const taken = takenSlotCodesForDay(mealPlan, day.isoDate);
                return (
                  <Pressable
                    key={day.isoDate}
                    onPress={() => void confirmPlan(day.isoDate, selectedSlot)}
                    className={`mr-2 min-w-[72px] rounded-2xl px-3 py-2 ${
                      selected ? 'bg-primary' : 'border border-border bg-paper'
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  >
                    <Text
                      className={`text-center text-xs font-bold ${
                        selected ? 'text-on-primary' : 'text-ink'
                      }`}
                    >
                      {day.label}
                    </Text>
                    {taken.length > 0 ? (
                      <Text
                        className={`mt-0.5 text-center text-[10px] ${
                          selected ? 'text-on-primary-muted' : 'text-muted'
                        }`}
                      >
                        {taken.join('·')}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => setMonthOpen(true)}
              className="mt-3 self-start"
              hitSlop={8}
            >
              <Text className="text-xs font-bold text-primary-dark">{SEAMLESS_FLOW_COPY.moreDates}</Text>
            </Pressable>

            <Pressable onPress={() => setStep('choose')} className="mt-4 items-center py-2">
              <Text className="font-semibold text-muted">Back</Text>
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
            void confirmPlan(isoDate, selectedSlot);
          }}
        />
      </>
    );
  }

  return (
    <Pressable className="flex-1 justify-end bg-black/40" onPress={handleDismiss}>
      <Pressable className="max-h-[85%] rounded-t-3xl bg-card px-4 pb-8 pt-4" onPress={() => undefined}>
        {heroUri ? (
          <RecipeThumbnail
            uri={heroUri}
            height={Math.round(RECIPE_IMAGE.listHeight * 1.1)}
            accessibilityLabel=""
            className="mb-3 overflow-hidden rounded-xl"
          />
        ) : null}
        <Text className="text-lg font-bold text-ink">{SEAMLESS_FLOW_COPY.sheetTitle}</Text>
        <Text className="mt-1 text-sm text-muted" numberOfLines={2}>{target.title}</Text>

        <View className="mt-4 gap-2">
          <PrimaryActionButton label={SEAMLESS_FLOW_COPY.cookNow} onPress={startCookNow} />
          <PrimaryActionButton
            variant="secondary"
            label={SEAMLESS_FLOW_COPY.planIt}
            onPress={() => setStep('plan')}
          />
        </View>

        <Pressable
          onPress={() => {
            markSettled();
            logSeamlessEvent(target.refKey, 'just_save', logBase());
            target.onJustSave?.();
            onClose();
          }}
          className="mt-4 items-center py-3"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-sm font-semibold text-muted">{SEAMLESS_FLOW_COPY.justSave}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

export function ScheduleRecipeSheet({ visible, target, onClose }: ScheduleRecipeSheetProps) {
  const today = localDateString();

  if (!visible || !target) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <ScheduleRecipeSheetBody
        key={`${target.pantryRecipeId}-${target.sheetId ?? today}`}
        target={target}
        onClose={onClose}
        today={today}
      />
    </Modal>
  );
}

