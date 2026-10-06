import { MEAL_CALENDAR } from '../../config/mealCalendar';
import type {
  GroceryListItem,
  GroceryPlannedMealLink,
  MealPlanItem,
  MealSlot,
  PantryCategory,
} from '../../types/mealprep';
import { formatQuantityWithUnit } from '../formatQuantity';
import { convertQuantity, unitsAreConvertible } from '../units/conversion';
import { compareScheduledMeals } from '../mealCalendar/groupMeals';
import { buildLocalDayRange } from '../mealCalendar/dates';
import { normalizeIngredientName } from '../recipeMatch/normalize';
import { GROCERY_AISLE_ORDER } from '../grocery';
import { groceryDedupeKey } from '../recipeMatch/groceryFromMissing';
import { readJson, writeJson } from '../storage';

export const GROCERY_COMBINE_PREFERENCE_KEY = 'mealprep.groceryCombineList';

export function readGroceryCombinePreference(): boolean {
  return readJson<boolean>(GROCERY_COMBINE_PREFERENCE_KEY, false);
}

export function writeGroceryCombinePreference(combined: boolean): void {
  writeJson(GROCERY_COMBINE_PREFERENCE_KEY, combined);
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizePlannedMealLinks(links: GroceryPlannedMealLink[] | undefined | null): GroceryPlannedMealLink[] {
  if (!links?.length) return [];
  return links.map((link) => ({
    mealPlanItemId: link.mealPlanItemId,
    scheduledOn: link.scheduledOn ?? null,
    mealSlot: link.mealSlot ?? null,
    mealTitle: link.mealTitle,
  }));
}

/** True when the user has active planned meals that can drive day/meal grouping. */
export function hasMealPlanGroceryGrouping(mealPlan: MealPlanItem[]): boolean {
  return mealPlan.some((item) => !item.made && !item.leftoverOfId);
}

export function isManualOrUnlinkedGroceryItem(item: GroceryListItem): boolean {
  return item.plannedMealLinks.length === 0;
}

export function groceryItemLineKey(item: Pick<GroceryListItem, 'name' | 'unit'>): string {
  return groceryDedupeKey(item.name, item.unit);
}

export function mealSlotLabel(slot: MealSlot | null): string {
  if (!slot) return 'Meal';
  return MEAL_CALENDAR.slotLabels[slot];
}

export function formatMealGroupTitle(link: GroceryPlannedMealLink, weekdayLabel?: string): string {
  const day = weekdayLabel ?? (link.scheduledOn ? shortWeekday(link.scheduledOn) : 'Queue');
  const slot = mealSlotLabel(link.mealSlot);
  return `${day} · ${slot} · ${link.mealTitle}`;
}

function shortWeekday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
}

export interface GroceryMealGroup {
  mealPlanItemId: string | null;
  header: string;
  items: GroceryListItem[];
}

export interface GroceryDayGroup {
  key: string;
  dayLabel: string;
  isoDate: string | null;
  meals: GroceryMealGroup[];
}

/** Day → meal → items for open grocery rows. Manual / unlinked items land in an "Other" bucket. */
export function groupGroceryByDayAndMeal(
  items: GroceryListItem[],
  mealPlan: MealPlanItem[],
  startIso?: string,
): GroceryDayGroup[] {
  const days = buildLocalDayRange(MEAL_CALENDAR.daysAhead, startIso);
  const dayByIso = new Map(days.map((d) => [d.isoDate, d]));
  const groups: GroceryDayGroup[] = days.map((day) => ({
    key: day.isoDate,
    dayLabel: `${day.weekdayLabel} · ${day.monthDayLabel}`,
    isoDate: day.isoDate,
    meals: [],
  }));
  const groupByIso = new Map(groups.map((g) => [g.key, g]));

  const other: GroceryDayGroup = {
    key: 'other',
    dayLabel: 'Other',
    isoDate: null,
    meals: [],
  };

  const mealBuckets = new Map<string, GroceryMealGroup>();

  function ensureMealGroup(link: GroceryPlannedMealLink): GroceryMealGroup {
    const existing = mealBuckets.get(link.mealPlanItemId);
    if (existing) return existing;
    const day = link.scheduledOn ? groupByIso.get(link.scheduledOn) : null;
    const weekday = link.scheduledOn ? dayByIso.get(link.scheduledOn)?.weekdayLabel : undefined;
    const group: GroceryMealGroup = {
      mealPlanItemId: link.mealPlanItemId,
      header: formatMealGroupTitle(link, weekday),
      items: [],
    };
    mealBuckets.set(link.mealPlanItemId, group);
    if (day) {
      day.meals.push(group);
    } else {
      other.meals.push(group);
    }
    return group;
  }

  for (const item of items) {
    if (isManualOrUnlinkedGroceryItem(item)) {
      let manualBucket = other.meals.find((m) => m.mealPlanItemId === null);
      if (!manualBucket) {
        manualBucket = { mealPlanItemId: null, header: 'Added manually', items: [] };
        other.meals.unshift(manualBucket);
      }
      manualBucket.items.push(item);
      continue;
    }
    const link = item.plannedMealLinks[0];
    if (!link) {
      let manualBucket = other.meals.find((m) => m.mealPlanItemId === null);
      if (!manualBucket) {
        manualBucket = { mealPlanItemId: null, header: 'Added manually', items: [] };
        other.meals.unshift(manualBucket);
      }
      manualBucket.items.push(item);
      continue;
    }
    ensureMealGroup(link).items.push(item);
  }

  const scheduledMeals = mealPlan
    .filter((m) => !m.made && m.scheduledOn && !m.leftoverOfId)
    .sort(compareScheduledMeals);
  for (const group of groups) {
    group.meals.sort((a, b) => {
      const mealA = scheduledMeals.find((m) => m.id === a.mealPlanItemId);
      const mealB = scheduledMeals.find((m) => m.id === b.mealPlanItemId);
      if (mealA && mealB) return compareScheduledMeals(mealA, mealB);
      return a.header.localeCompare(b.header);
    });
  }
  other.meals.sort((a, b) => a.header.localeCompare(b.header));

  const result = groups.filter((g) => g.meals.some((m) => m.items.length > 0));
  if (other.meals.some((m) => m.items.length > 0)) {
    result.push(other);
  }
  return result;
}

export interface MergedGroceryLine {
  mergeKey: string;
  name: string;
  category: PantryCategory;
  quantityLabel: string;
  checked: boolean;
  underlyingIds: string[];
  mealHint: string;
  /** Representative row for community deals / pricing. */
  representative: GroceryListItem;
}

interface MergeBucket {
  mergeKey: string;
  name: string;
  category: PantryCategory;
  unit: string;
  quantity: number;
  altParts: { quantity: number; unit: string }[];
  items: GroceryListItem[];
}

function mergeKeyForItem(item: GroceryListItem): string {
  return normalizeIngredientName(item.name);
}

function addToBucket(bucket: MergeBucket, item: GroceryListItem): void {
  bucket.items.push(item);
  if (groceryItemLineKey(bucket) === groceryItemLineKey(item) && bucket.unit === item.unit) {
    bucket.quantity = roundQty(bucket.quantity + item.quantity);
    return;
  }
  if (unitsAreConvertible(bucket.unit, item.unit)) {
    const converted = convertQuantity(item.quantity, item.unit, bucket.unit);
    if (converted != null) {
      bucket.quantity = roundQty(bucket.quantity + converted);
      return;
    }
  }
  const existingAlt = bucket.altParts.find((p) => p.unit === item.unit);
  if (existingAlt) {
    existingAlt.quantity = roundQty(existingAlt.quantity + item.quantity);
  } else {
    bucket.altParts.push({ quantity: item.quantity, unit: item.unit });
  }
}

function formatMergedQuantity(bucket: MergeBucket): string {
  const primary = formatQuantityWithUnit(bucket.quantity, bucket.unit);
  if (bucket.altParts.length === 0) return primary;
  const extras = bucket.altParts.map((p) => formatQuantityWithUnit(p.quantity, p.unit));
  return [primary, ...extras].join(' + ');
}

export function formatMealHintForLinks(links: GroceryPlannedMealLink[]): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const day = link.scheduledOn ? shortWeekday(link.scheduledOn) : 'Queue';
    const label = `${day} ${link.mealTitle}`.trim();
    const key = `${link.mealPlanItemId}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(label);
  }
  return parts.join(', ');
}

export function collectMealLinksFromItems(items: GroceryListItem[]): GroceryPlannedMealLink[] {
  const links: GroceryPlannedMealLink[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const link of item.plannedMealLinks) {
      if (seen.has(link.mealPlanItemId)) continue;
      seen.add(link.mealPlanItemId);
      links.push(link);
    }
  }
  return links;
}

export function mergedGroceryChecked(items: GroceryListItem[]): boolean {
  return items.length > 0 && items.every((item) => item.checked);
}

/** One shopping list merged by ingredient name with summed quantities when units convert. */
export function mergeGroceryItemsForCombinedView(items: GroceryListItem[]): MergedGroceryLine[] {
  const buckets = new Map<string, MergeBucket>();
  for (const item of items) {
    const key = mergeKeyForItem(item);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        mergeKey: key,
        name: item.name,
        category: item.category,
        unit: item.unit,
        quantity: 0,
        altParts: [],
        items: [],
      };
      buckets.set(key, bucket);
    }
    addToBucket(bucket, item);
  }

  const merged: MergedGroceryLine[] = [];
  for (const bucket of buckets.values()) {
    const links = collectMealLinksFromItems(bucket.items);
    merged.push({
      mergeKey: bucket.mergeKey,
      name: bucket.name,
      category: bucket.category,
      quantityLabel: formatMergedQuantity(bucket),
      checked: mergedGroceryChecked(bucket.items),
      underlyingIds: bucket.items.map((i) => i.id),
      mealHint: formatMealHintForLinks(links),
      representative: bucket.items[0]!,
    });
  }

  const aisleRank = new Map(GROCERY_AISLE_ORDER.map((cat, index) => [cat, index]));
  return merged.sort((a, b) => {
    const catDiff = (aisleRank.get(a.category) ?? 99) - (aisleRank.get(b.category) ?? 99);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });
}

export function pruneGroceryForRemovedMeals(
  grocery: GroceryListItem[],
  removedMealPlanIds: readonly string[],
): GroceryListItem[] {
  const removed = new Set(removedMealPlanIds);
  return grocery
    .map((item) => {
      if (!item.plannedMealLinks.length) return item;
      const nextLinks = item.plannedMealLinks.filter((link) => !removed.has(link.mealPlanItemId));
      return { ...item, plannedMealLinks: nextLinks };
    })
    .filter((item) => {
      if (item.checked) return true;
      if (item.plannedMealLinks.length > 0) return true;
      return item.origin !== 'plan';
    });
}
