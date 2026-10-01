import type { SupabaseClient } from '@supabase/supabase-js';
import { FEATURE_FLAG_DEFAULTS, PHOTO_SCAN } from '../config/appConfig';
import { USER_PREFERENCE_DEFAULTS } from '../config/userPreferences';
import { formatSupabaseError, isMissingSchemaError } from './supabaseErrors';
import { normalizePantryStorageLocation } from '../config/pantryStorage';
import { pantryPhotoUrlForStorage } from './pantryPhotoStorage';
import { withTimeout } from './withTimeout';
import { recipeApiMasterSlug, recipeApiPersonalSlug } from './recipeDiscovery/slugs';
import type {
  FeatureFlagKey,
  FeatureFlags,
  GroceryListItem,
  PantryCategory,
  PantryItem,
  Recipe,
  RecipeIngredient,
  UserAnalytics,
  MealPlanItem,
  UserProfile,
  UserRole,
} from '../types/mealprep';

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  photo_url: string | null;
  household_size: number;
  dietary_notes: string | null;
  home_zip: string | null;
  home_lat: number | null;
  home_lng: number | null;
  home_location_updated_at: string | null;
  created_at: string;
  auto_add_missing_to_grocery?: boolean | null;
};

type PantryRow = {
  id: string;
  ingredient_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string | null;
  photo_url: string | null;
  expires_on: string | null;
  updated_at: string;
};

type RecipeRow = {
  id: string;
  slug: string | null;
  name: string;
  tag: string | null;
  description: string | null;
  servings: number;
  minutes: number;
  calories: number;
  protein: number;
  carbs: number | null;
  fat: number | null;
  nutrition_source: string | null;
  nutrition_citation: string | null;
  nutrition_sourced_at: string | null;
  ingredients: RecipeIngredient[] | null;
  steps: string[] | null;
  is_master: boolean;
  created_at: string;
};

type GroceryRow = {
  id: string;
  ingredient_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  checked: boolean;
  source_recipe_ids: string[] | null;
};

type FlagRow = { key: string; enabled: boolean };

type MealPlanRow = {
  id: string;
  user_id: string;
  recipe_slug: string | null;
  recipe_api_id: number | null;
  title: string;
  image_url: string | null;
  made: boolean;
  made_at?: string | null;
  added_at: string;
};

const MEAL_PLAN_MIGRATION_SQL = 'supabase/migrations/20261001130000_meal_plan_made_at_prefs.sql';

function asCategory(value: string): PantryCategory {
  const categories: PantryCategory[] = [
    'spices',
    'meats',
    'produce',
    'dairy',
    'dry_goods',
    'cookware',
    'frozen',
    'condiments',
  ];
  return categories.includes(value as PantryCategory) ? (value as PantryCategory) : 'dry_goods';
}

export function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    photoUrl: row.photo_url,
    householdSize: row.household_size,
    dietaryNotes: row.dietary_notes ?? '',
    homeZip: row.home_zip ?? undefined,
    homeLat: row.home_lat ?? undefined,
    homeLng: row.home_lng ?? undefined,
    homeLocationUpdatedAt: row.home_location_updated_at ?? undefined,
    createdAt: row.created_at,
    preferences: {
      autoAddMissingToGrocery:
        row.auto_add_missing_to_grocery ?? USER_PREFERENCE_DEFAULTS.autoAddMissingToGrocery,
    },
  };
}

export function mapPantry(row: PantryRow): PantryItem {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    name: row.name,
    category: asCategory(row.category),
    quantity: Number(row.quantity),
    unit: row.unit,
    location: normalizePantryStorageLocation(row.location),
    photoUri: row.photo_url,
    expiresOn: row.expires_on,
    updatedAt: row.updated_at,
  };
}

export function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.slug ?? row.id,
    name: row.name,
    tag: row.tag ?? '',
    description: row.description ?? '',
    servings: row.servings,
    minutes: row.minutes,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs ?? 0,
    fat: row.fat ?? 0,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    isMaster: row.is_master,
    createdAt: row.created_at,
    nutritionSource: row.nutrition_source ?? undefined,
    nutritionCitation: row.nutrition_citation ?? undefined,
    nutritionSourcedAt: row.nutrition_sourced_at ?? undefined,
  };
}

export function mapGrocery(row: GroceryRow): GroceryListItem {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    name: row.name,
    category: asCategory(row.category),
    quantity: Number(row.quantity),
    unit: row.unit,
    checked: row.checked,
    sourceRecipeIds: row.source_recipe_ids ?? [],
  };
}

export function mapMealPlanItem(row: MealPlanRow): MealPlanItem {
  return {
    id: row.id,
    recipeSlug: row.recipe_slug,
    recipeApiId: row.recipe_api_id,
    title: row.title,
    imageUrl: row.image_url,
    made: row.made_at != null ? true : row.made,
    madeAt: row.made_at ?? (row.made ? row.added_at : null),
    addedAt: row.added_at,
  };
}

export function mapFeatureFlags(rows: FlagRow[]): FeatureFlags {
  const merged = { ...FEATURE_FLAG_DEFAULTS };
  for (const row of rows) {
    if (row.key in merged) {
      merged[row.key as FeatureFlagKey] = row.enabled;
    }
  }
  return merged;
}

export async function fetchLiveBundle(client: SupabaseClient, userId: string) {
  const [profileRes, pantryRes, recipesRes, groceryRes, flagsRes, countsRes, mealPlanRes] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('pantry_items').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
    client
      .from('recipes')
      .select('*')
      .or(`is_master.eq.true,created_by.eq.${userId}`)
      .order('created_at', { ascending: true }),
    client.from('grocery_list_items').select('*').eq('user_id', userId).order('name'),
    client.from('feature_flags').select('key, enabled'),
    client.from('profiles').select('role', { count: 'exact', head: false }),
    client
      .from('meal_plan_items')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false }),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (pantryRes.error) throw pantryRes.error;
  if (recipesRes.error) throw recipesRes.error;
  if (groceryRes.error) throw groceryRes.error;
  if (flagsRes.error) throw flagsRes.error;
  if (mealPlanRes.error && mealPlanRes.error.code !== 'PGRST205') throw mealPlanRes.error;

  const profiles = (countsRes.data ?? []) as { role: UserRole }[];
  const adminCount = profiles.filter((p) => p.role === 'admin').length;

  const analytics: UserAnalytics = {
    userCount: profiles.length,
    adminCount,
    memberCount: profiles.length - adminCount,
    pantryItems: pantryRes.data?.length ?? 0,
    recipes: recipesRes.data?.length ?? 0,
    groceryOpen: (groceryRes.data ?? []).filter((g: GroceryRow) => !g.checked).length,
    lastActiveAt: new Date().toISOString(),
  };

  return {
    profile: profileRes.data ? mapProfile(profileRes.data as ProfileRow) : null,
    pantry: (pantryRes.data ?? []).map((row) => mapPantry(row as PantryRow)),
    recipes: (recipesRes.data ?? []).map((row) => mapRecipe(row as RecipeRow)),
    grocery: (groceryRes.data ?? []).map((row) => mapGrocery(row as GroceryRow)),
    featureFlags: mapFeatureFlags((flagsRes.data ?? []) as FlagRow[]),
    mealPlan: (mealPlanRes.data ?? []).map((row) => mapMealPlanItem(row as MealPlanRow)),
    analytics,
  };
}

function pantryInsertRow(userId: string, item: PantryItem) {
  return {
    user_id: userId,
    ingredient_id: item.ingredientId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    location: item.location,
    photo_url: pantryPhotoUrlForStorage(item.photoUri),
    expires_on: item.expiresOn,
  };
}

export async function insertPantryItem(
  client: SupabaseClient,
  userId: string,
  item: PantryItem,
): Promise<PantryItem> {
  const request = client.from('pantry_items').insert(pantryInsertRow(userId, item)).select('*').single();
  const { data, error } = await withTimeout(
    request,
    PHOTO_SCAN.saveTimeoutMs,
    PHOTO_SCAN.saveTimeoutMessage,
  );
  if (error) throw error;
  if (!data) {
    throw new Error('Pantry item was not saved. Check that you are signed in and try again.');
  }
  return mapPantry(data as PantryRow);
}

export async function insertPantryItems(
  client: SupabaseClient,
  userId: string,
  items: PantryItem[],
): Promise<PantryItem[]> {
  if (items.length === 0) return [];
  const request = client
    .from('pantry_items')
    .insert(items.map((item) => pantryInsertRow(userId, item)))
    .select('*');
  const { data, error } = await withTimeout(
    request,
    PHOTO_SCAN.saveTimeoutMs,
    PHOTO_SCAN.saveTimeoutMessage,
  );
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length !== items.length) {
    throw new Error(
      rows.length === 0
        ? 'Could not save pantry items. Check that you are signed in and try again.'
        : `Only ${rows.length} of ${items.length} pantry items were saved.`,
    );
  }
  return rows.map((row) => mapPantry(row as PantryRow));
}

export async function updatePantryItem(
  client: SupabaseClient,
  userId: string,
  item: PantryItem,
): Promise<PantryItem> {
  const { data, error } = await client
    .from('pantry_items')
    .update({
      ingredient_id: item.ingredientId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      location: item.location,
      photo_url: pantryPhotoUrlForStorage(item.photoUri),
      expires_on: item.expiresOn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return mapPantry(data as PantryRow);
}

export async function deletePantryItemsByIds(
  client: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from('pantry_items').delete().eq('user_id', userId).in('id', ids);
  if (error) throw error;
}

export async function deleteAllPantryItems(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('pantry_items').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function upsertImportedRecipe(
  client: SupabaseClient,
  userId: string,
  recipe: Recipe,
  options: { asMaster: boolean; recipeApiId: number },
): Promise<Recipe> {
  const masterSlug = recipeApiMasterSlug(options.recipeApiId);
  const storageSlug = options.asMaster ? masterSlug : recipeApiPersonalSlug(options.recipeApiId, userId);

  if (!options.asMaster) {
    const { data: existingMaster, error: masterLookupError } = await client
      .from('recipes')
      .select('*')
      .eq('slug', masterSlug)
      .eq('is_master', true)
      .maybeSingle();
    if (masterLookupError) throw masterLookupError;
    if (existingMaster) return mapRecipe(existingMaster as RecipeRow);
  }

  const payload = {
    slug: storageSlug,
    name: recipe.name,
    description: recipe.description,
    tag: recipe.tag,
    servings: recipe.servings,
    minutes: recipe.minutes,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    is_master: options.asMaster,
    created_by: userId,
    nutrition_source: recipe.nutritionSource ?? 'RecipeAPI.io',
    nutrition_citation: recipe.nutritionCitation ?? '',
    nutrition_sourced_at: recipe.nutritionSourcedAt ?? new Date().toISOString(),
  };

  const { data, error } = await client
    .from('recipes')
    .upsert(payload, { onConflict: 'slug' })
    .select('*')
    .single();
  if (error) throw error;
  return mapRecipe(data as RecipeRow);
}

export async function updateMasterRecipe(client: SupabaseClient, recipe: Recipe) {
  const payload = {
    name: recipe.name,
    description: recipe.description,
    tag: recipe.tag,
    servings: recipe.servings,
    minutes: recipe.minutes,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    nutrition_source: recipe.nutritionSource ?? '',
    nutrition_citation: recipe.nutritionCitation ?? '',
    nutrition_sourced_at: recipe.nutritionSourcedAt ?? null,
  };
  const bySlug = await client.from('recipes').update(payload).eq('slug', recipe.id).select('id');
  if (bySlug.error) throw bySlug.error;
  if ((bySlug.data?.length ?? 0) > 0) return;
  const byId = await client.from('recipes').update(payload).eq('id', recipe.id);
  if (byId.error) throw byId.error;
}

export async function upsertFeatureFlag(client: SupabaseClient, key: FeatureFlagKey, enabled: boolean) {
  const { error } = await client.from('feature_flags').upsert({ key, enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
}

function groceryRowKey(ingredientId: string, unit: string): string {
  return `${ingredientId}::${unit}`;
}

function isPersistedGroceryId(id: string, existingIds: Set<string>): boolean {
  return existingIds.has(id);
}

export async function replaceGroceryList(
  client: SupabaseClient,
  userId: string,
  items: GroceryListItem[],
): Promise<GroceryListItem[]> {
  const { data: existingRows, error: fetchError } = await client
    .from('grocery_list_items')
    .select('*')
    .eq('user_id', userId);
  if (fetchError) throw fetchError;

  const existing = (existingRows ?? []) as GroceryRow[];
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const existingIds = new Set(existing.map((row) => row.id));
  const existingByKey = new Map(existing.map((row) => [groceryRowKey(row.ingredient_id, row.unit), row]));

  const persisted: GroceryListItem[] = [];
  const keptIds = new Set<string>();

  for (const item of items) {
    const key = groceryRowKey(item.ingredientId, item.unit);
    const matched =
      (isPersistedGroceryId(item.id, existingIds) ? existingById.get(item.id) : undefined) ??
      existingByKey.get(key);

    const payload = {
      user_id: userId,
      ingredient_id: item.ingredientId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      checked: item.checked,
      source_recipe_ids: item.sourceRecipeIds,
    };

    if (matched) {
      const { data, error } = await client
        .from('grocery_list_items')
        .update(payload)
        .eq('id', matched.id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;
      keptIds.add(matched.id);
      persisted.push(mapGrocery(data as GroceryRow));
      continue;
    }

    const { data, error } = await client.from('grocery_list_items').insert(payload).select('*').single();
    if (error) throw error;
    keptIds.add((data as GroceryRow).id);
    persisted.push(mapGrocery(data as GroceryRow));
  }

  const toRemove = existing.filter((row) => !keptIds.has(row.id)).map((row) => row.id);
  if (toRemove.length > 0) {
    const { error: deleteError } = await client.from('grocery_list_items').delete().eq('user_id', userId).in('id', toRemove);
    if (deleteError) throw deleteError;
  }

  return persisted.sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateGroceryChecked(
  client: SupabaseClient,
  id: string,
  checked: boolean,
): Promise<void> {
  const { error } = await client.from('grocery_list_items').update({ checked }).eq('id', id);
  if (error) throw error;
}

export async function insertGroceryItem(
  client: SupabaseClient,
  userId: string,
  item: GroceryListItem,
): Promise<GroceryListItem> {
  const { data, error } = await client
    .from('grocery_list_items')
    .insert({
      user_id: userId,
      ingredient_id: item.ingredientId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      checked: item.checked,
      source_recipe_ids: item.sourceRecipeIds,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapGrocery(data as GroceryRow);
}

export async function deleteGroceryItems(
  client: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from('grocery_list_items').delete().eq('user_id', userId).in('id', ids);
  if (error) throw error;
}

export async function insertMealPlanItem(
  client: SupabaseClient,
  userId: string,
  item: Omit<MealPlanItem, 'id'>,
): Promise<MealPlanItem> {
  const basePayload = {
    user_id: userId,
    recipe_slug: item.recipeSlug,
    recipe_api_id: item.recipeApiId,
    title: item.title,
    image_url: item.imageUrl,
    made: item.made,
    added_at: item.addedAt,
  };

  let { data, error } = await client
    .from('meal_plan_items')
    .insert({ ...basePayload, made_at: item.madeAt })
    .select('*')
    .single();

  if (error && isMissingSchemaError(error)) {
    const fallback = await client.from('meal_plan_items').insert(basePayload).select('*').single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(formatSupabaseError(error, MEAL_PLAN_MIGRATION_SQL));
  }
  return mapMealPlanItem(data as MealPlanRow);
}

export async function updateMealPlanItem(
  client: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<Pick<MealPlanItem, 'made' | 'madeAt'>>,
): Promise<MealPlanItem> {
  const made = patch.made;
  const madeAt =
    patch.madeAt !== undefined
      ? patch.madeAt
      : made === true
        ? new Date().toISOString()
        : made === false
          ? null
          : undefined;

  const withTimestamp: Record<string, unknown> = {};
  if (made !== undefined) withTimestamp.made = made;
  if (madeAt !== undefined) withTimestamp.made_at = madeAt;

  let { data, error } = await client
    .from('meal_plan_items')
    .update(withTimestamp)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();

  if (error && isMissingSchemaError(error) && 'made_at' in withTimestamp) {
    const fallbackPayload: Record<string, unknown> = {};
    if (made !== undefined) fallbackPayload.made = made;
    const fallback = await client
      .from('meal_plan_items')
      .update(fallbackPayload)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(formatSupabaseError(error, MEAL_PLAN_MIGRATION_SQL));
  }
  return mapMealPlanItem(data as MealPlanRow);
}

export async function updateProfilePreferences(
  client: SupabaseClient,
  userId: string,
  preferences: Pick<UserProfile['preferences'], 'autoAddMissingToGrocery'>,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ auto_add_missing_to_grocery: preferences.autoAddMissingToGrocery })
    .eq('id', userId);

  if (error && isMissingSchemaError(error)) {
    throw new Error(formatSupabaseError(error, MEAL_PLAN_MIGRATION_SQL));
  }
  if (error) throw error;
}

export async function deleteMealPlanItem(
  client: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await client.from('meal_plan_items').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
