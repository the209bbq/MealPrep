import { CATEGORY_LABELS } from '../config/appConfig';
import {
  PANTRY_STORAGE_LOCATIONS,
  labelForPantryStorageLocation,
  type PantryStorageLocation,
} from '../config/pantryStorage';
import type { PantryCategory, PantryItem } from '../types/mealprep';

export interface PantryCategoryGroup {
  category: PantryCategory;
  label: string;
  items: PantryItem[];
}

export interface PantryLocationSection {
  location: PantryStorageLocation;
  label: string;
  items: PantryItem[];
  categoryGroups: PantryCategoryGroup[];
}

export function groupPantryIntoLocationSections(
  items: PantryItem[],
  options: { categoryFilter: PantryCategory | 'all'; locationFilter: PantryStorageLocation | 'all' },
): PantryLocationSection[] {
  const filtered = items.filter((item) => {
    const categoryOk = options.categoryFilter === 'all' || item.category === options.categoryFilter;
    const locationOk = options.locationFilter === 'all' || item.location === options.locationFilter;
    return categoryOk && locationOk;
  });

  return PANTRY_STORAGE_LOCATIONS.map((location) => {
    const locationItems = filtered
      .filter((item) => item.location === location)
      .sort((a, b) => a.name.localeCompare(b.name));

    const byCategory = new Map<PantryCategory, PantryItem[]>();
    for (const item of locationItems) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const categoryGroups: PantryCategoryGroup[] = [...byCategory.entries()]
      .sort(([a], [b]) => CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b]))
      .map(([category, groupItems]) => ({
        category,
        label: CATEGORY_LABELS[category],
        items: groupItems,
      }));

    return {
      location,
      label: labelForPantryStorageLocation(location),
      items: locationItems,
      categoryGroups,
    };
  }).filter((section) => options.locationFilter === 'all' || section.location === options.locationFilter);
}

export function countPantryItemsInLocation(items: PantryItem[], location: PantryStorageLocation): number {
  return items.filter((item) => item.location === location).length;
}

export interface PantryLocationFilterCounts {
  all: number;
  pantry: number;
  fridge: number;
  spice_rack: number;
}

/** Item counts per storage tab, respecting an optional category filter (not location). */
export function countPantryItemsForLocationFilters(
  items: PantryItem[],
  categoryFilter: PantryCategory | 'all',
): PantryLocationFilterCounts {
  const filtered = items.filter(
    (item) => categoryFilter === 'all' || item.category === categoryFilter,
  );
  const counts = Object.fromEntries(
    PANTRY_STORAGE_LOCATIONS.map((location) => [
      location,
      filtered.filter((item) => item.location === location).length,
    ]),
  ) as Record<PantryStorageLocation, number>;
  return {
    all: filtered.length,
    ...counts,
  };
}
