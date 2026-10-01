import {
  USDA_DEMO_API_KEY,
  USDA_FDC_FOOD_URL,
  USDA_FDC_SEARCH_URL,
  USDA_SEARCH_DATA_TYPE,
  USDA_SETTINGS_STORAGE_KEY,
} from '../config/appConfig';
import type { NutritionField, NutritionValues, Recipe, RecipeIngredient, UsdaFoodMatch } from '../types/mealprep';
import { NUTRITION_FIELDS } from '../types/mealprep';
import { getUsdaFoodViaProxy, searchUsdaFoodsViaProxy } from './usda/proxyClient';
import type { UsdaFoodPayload } from './usda/types';
import { readJson, writeJson } from './storage';

const USDA_NUTRIENT_IDS: Record<NutritionField, number[]> = {
  calories: [1008, 2047, 2048],
  protein: [1003],
  carbs: [1005],
  fat: [1004],
  fiber: [1079],
  sodium: [1093],
  potassium: [1092],
  calcium: [1087],
  iron: [1089],
};

export function emptyNutrition(): NutritionValues {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
  };
}

function roundNutrition(value: number, field: NutritionField): number {
  if (!Number.isFinite(value)) return 0;
  const micros = field === 'sodium' || field === 'potassium' || field === 'calcium' || field === 'iron';
  return Number(value.toFixed(micros ? 1 : 1));
}

export function sanitizeNutrition(raw: Partial<NutritionValues> | null | undefined): NutritionValues {
  const next = emptyNutrition();
  if (!raw || typeof raw !== 'object') return next;
  for (const field of NUTRITION_FIELDS) {
    next[field] = roundNutrition(Number(raw[field] ?? 0), field);
  }
  return next;
}

export function nutritionHasValues(nutrition: NutritionValues): boolean {
  return Object.values(sanitizeNutrition(nutrition)).some((value) => value > 0);
}

export function getStoredUsdaApiKey(): string {
  return readJson<string>(USDA_SETTINGS_STORAGE_KEY, '').trim();
}

export function setStoredUsdaApiKey(key: string): void {
  writeJson(USDA_SETTINGS_STORAGE_KEY, key.trim());
}

/** Device-only override for direct USDA fallback (never commit keys; server uses `usda-proxy`). */
export function resolveUsdaDirectApiKey(override?: string): string {
  const fromOverride = (override ?? '').trim();
  if (fromOverride) return fromOverride;
  const fromStorage = getStoredUsdaApiKey();
  if (fromStorage) return fromStorage;
  return USDA_DEMO_API_KEY;
}

function readNutrientNumber(food: UsdaFoodPayload, ids: number[]): number {
  const nutrients = food.foodNutrients ?? [];
  for (const id of ids) {
    const match = nutrients.find((item) => {
      const nutrientId = item.nutrientId ?? item.nutrient?.id ?? item.nutrientNumber;
      return Number(nutrientId) === Number(id) || String(item.nutrientNumber) === String(id);
    });
    if (match) {
      const value = match.value ?? match.amount;
      if (Number.isFinite(Number(value))) return Number(value);
    }
  }
  return 0;
}

export function nutritionFromUsdaFood(food: UsdaFoodPayload): NutritionValues {
  const nutrition = emptyNutrition();
  for (const field of NUTRITION_FIELDS) {
    nutrition[field] = roundNutrition(readNutrientNumber(food, USDA_NUTRIENT_IDS[field]), field);
  }
  return nutrition;
}

export function scaleNutrition(nutrition: NutritionValues, grams: number): NutritionValues {
  const qty = Number(grams);
  const factor = Number.isFinite(qty) && qty > 0 ? qty / 100 : 1;
  const scaled = emptyNutrition();
  for (const field of NUTRITION_FIELDS) {
    scaled[field] = roundNutrition(nutrition[field] * factor, field);
  }
  return scaled;
}

export function sumNutrition(items: NutritionValues[]): NutritionValues {
  const total = emptyNutrition();
  for (const item of items) {
    const nutrition = sanitizeNutrition(item);
    for (const field of NUTRITION_FIELDS) {
      total[field] = roundNutrition(total[field] + nutrition[field], field);
    }
  }
  return total;
}

function usdaCitation(food: UsdaFoodPayload) {
  const name = food.description ?? food.lowercaseDescription ?? 'USDA food';
  const fdcId = food.fdcId;
  const dataType = food.dataType ?? 'FoodData Central';
  return {
    source: 'USDA FoodData Central',
    citation: `${name} (FDC ID ${fdcId}, ${dataType})`,
    url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
    fdcId,
  };
}

async function usdaFetchDirect(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`USDA lookup failed (${response.status}). Check your API key in Admin settings.`);
  }
  return response.json();
}

function mapFoodsToMatches(foods: UsdaFoodPayload[]): UsdaFoodMatch[] {
  return foods.map((food) => {
    const cite = usdaCitation(food);
    return {
      name: food.description ?? 'USDA food',
      dataType: food.dataType ?? '',
      brand: food.brandOwner ?? '',
      nutritionPer100g: nutritionFromUsdaFood(food),
      ...cite,
    };
  });
}

async function searchUsdaFoodsDirect(
  query: string,
  pageSize: number,
  apiKey?: string,
): Promise<UsdaFoodMatch[]> {
  const params = new URLSearchParams({
    query: query.trim(),
    pageSize: String(pageSize),
    dataType: USDA_SEARCH_DATA_TYPE,
    api_key: resolveUsdaDirectApiKey(apiKey),
  });

  const data = (await usdaFetchDirect(`${USDA_FDC_SEARCH_URL}?${params.toString()}`)) as {
    foods?: UsdaFoodPayload[];
  };

  return mapFoodsToMatches(data.foods ?? []);
}

async function getUsdaFoodDirect(fdcId: number, apiKey?: string): Promise<UsdaFoodPayload> {
  const params = new URLSearchParams({ api_key: resolveUsdaDirectApiKey(apiKey) });
  return (await usdaFetchDirect(
    `${USDA_FDC_FOOD_URL}/${encodeURIComponent(String(fdcId))}?${params.toString()}`,
  )) as UsdaFoodPayload;
}

export async function searchUsdaFoods(query: string, pageSize = 8, apiKey?: string): Promise<UsdaFoodMatch[]> {
  const q = query.trim();
  if (!q) return [];

  const proxied = await searchUsdaFoodsViaProxy(q, pageSize);
  if (proxied !== null) {
    return mapFoodsToMatches(proxied);
  }

  return searchUsdaFoodsDirect(q, pageSize, apiKey);
}

export async function getUsdaFoodScaled(
  fdcId: number,
  grams: number,
  apiKey?: string,
): Promise<{
  per100g: NutritionValues;
  scaled: NutritionValues;
  source: string;
  citation: string;
  url: string;
}> {
  const proxied = await getUsdaFoodViaProxy(fdcId);
  const food = proxied ?? (await getUsdaFoodDirect(fdcId, apiKey));
  const cite = usdaCitation(food);
  const per100g = nutritionFromUsdaFood(food);
  const scaled = scaleNutrition(per100g, grams);
  return { per100g, scaled, ...cite };
}

export function applyIngredientUsda(
  ingredient: RecipeIngredient,
  fdcId: number,
  scaled: NutritionValues,
  meta: { source: string; citation: string },
): RecipeIngredient {
  return {
    ...ingredient,
    fdcId: String(fdcId),
    grams: ingredient.grams ?? 100,
    nutrition: scaled,
    nutritionSource: meta.source,
    nutritionCitation: meta.citation,
    nutritionSourcedAt: new Date().toISOString(),
  };
}

export function recipeNutritionFromIngredients(recipe: Recipe): NutritionValues {
  const totals = sumNutrition(
    recipe.ingredients.map((ing) => sanitizeNutrition(ing.nutrition ?? emptyNutrition())),
  );
  const portions = recipe.servings > 0 ? recipe.servings : 1;
  const perServing = emptyNutrition();
  for (const field of NUTRITION_FIELDS) {
    perServing[field] = roundNutrition(totals[field] / portions, field);
  }
  return perServing;
}

export function applyRecipeTotalsFromIngredients(recipe: Recipe): Recipe {
  const perServing = recipeNutritionFromIngredients(recipe);
  if (!nutritionHasValues(perServing)) return recipe;
  return {
    ...recipe,
    calories: Math.round(perServing.calories),
    protein: Math.round(perServing.protein),
    carbs: Math.round(perServing.carbs),
    fat: Math.round(perServing.fat),
    nutritionSource: 'USDA FoodData Central (ingredients)',
    nutritionCitation: 'Summed from ingredient USDA records',
    nutritionSourcedAt: new Date().toISOString(),
  };
}

export function nutritionLabel(recipe: Pick<Recipe, 'calories' | 'protein' | 'carbs' | 'fat'>): string {
  const parts = [`${recipe.calories || 0} Cal`, `${recipe.protein || 0}g Protein`];
  if (recipe.carbs) parts.push(`${recipe.carbs}g Carbs`);
  if (recipe.fat) parts.push(`${recipe.fat}g Fat`);
  return parts.join(' · ');
}
