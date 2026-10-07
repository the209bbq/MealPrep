import type { PantryCategory, PantryItem, PantryStorageLocation } from '../../types/mealprep';

export interface ManualPantryItemInput {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  location: PantryStorageLocation;
  expiresOn?: string | null;
}

export function buildManualPantryItem(input: ManualPantryItemInput, nowMs = Date.now()): PantryItem {
  const trimmedName = input.name.trim();
  const slug = trimmedName.toLowerCase().replace(/\s+/g, '-');
  return {
    id: `manual-${nowMs}`,
    ingredientId: `manual-${slug}-${nowMs}`,
    name: trimmedName,
    category: input.category,
    quantity: input.quantity,
    unit: input.unit.trim() || 'each',
    location: input.location,
    photoUri: null,
    expiresOn: input.expiresOn ?? null,
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function prependPantryItem(pantry: PantryItem[], item: PantryItem): PantryItem[] {
  return [item, ...pantry];
}
