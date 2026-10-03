import { isDemoMode, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config/appConfig';
import { LIBRARY_RECIPES } from '../../config/libraryRecipes';
import { getSupabase } from '../supabase';
import { DEMO_LIBRARY_RECIPE_ROWS } from './demoSamples';
import { libraryRowToAppRecipe } from './mapToAppRecipe';
import type { LibraryRecipeRow } from './types';
import type { Recipe } from '../../types/mealprep';

const memoryCache: { recipes: Recipe[] | null; expiresAt: number } = {
  recipes: null,
  expiresAt: 0,
};

function readCache(): Recipe[] | null {
  if (memoryCache.recipes && memoryCache.expiresAt > Date.now()) {
    return memoryCache.recipes;
  }
  return null;
}

function writeCache(recipes: Recipe[]): void {
  memoryCache.recipes = recipes;
  memoryCache.expiresAt = Date.now() + LIBRARY_RECIPES.clientCacheTtlMs;
}

function parseIngredientRows(raw: unknown): LibraryRecipeRow['ingredients'] {
  if (!Array.isArray(raw)) return [];
  const out: LibraryRecipeRow['ingredients'] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    const quantity =
      typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? row.quantity : 1;
    const unit = typeof row.unit === 'string' && row.unit.trim() ? row.unit.trim() : 'each';
    const note = typeof row.note === 'string' && row.note.trim() ? row.note.trim() : null;
    out.push({ name, quantity, unit, note });
  }
  return out;
}

function rowFromDb(raw: Record<string, unknown>): LibraryRecipeRow | null {
  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!slug || !title) return null;
  const steps: string[] = [];
  if (Array.isArray(raw.steps)) {
    for (const step of raw.steps) {
      if (typeof step === 'string' && step.trim()) steps.push(step.trim());
    }
  }
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim())
    : null;

  return {
    id: typeof raw.id === 'string' ? raw.id : slug,
    slug,
    title,
    dish_name: typeof raw.dish_name === 'string' ? raw.dish_name : title,
    servings: typeof raw.servings === 'number' ? raw.servings : 4,
    prep_minutes: typeof raw.prep_minutes === 'number' ? raw.prep_minutes : null,
    cook_minutes: typeof raw.cook_minutes === 'number' ? raw.cook_minutes : null,
    ingredients: parseIngredientRows(raw.ingredients),
    steps,
    tags,
    cuisine: typeof raw.cuisine === 'string' ? raw.cuisine : null,
    image_url: typeof raw.image_url === 'string' ? raw.image_url : null,
    status: raw.status === 'published' ? 'published' : 'draft',
    review_notes: typeof raw.review_notes === 'string' ? raw.review_notes : null,
    model: typeof raw.model === 'string' ? raw.model : null,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date(0).toISOString(),
  };
}

/** Fetch published library recipes for the Recipes feed (guests + signed-in). */
export async function fetchPublishedLibraryRecipes(options?: {
  forceRefresh?: boolean;
}): Promise<Recipe[]> {
  if (!options?.forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  if (isDemoMode()) {
    const demo = DEMO_LIBRARY_RECIPE_ROWS.map(libraryRowToAppRecipe);
    writeCache(demo);
    return demo;
  }

  const client = getSupabase();
  if (client) {
    const { data, error } = await client
      .from(LIBRARY_RECIPES.table)
      .select(
        'id,slug,title,dish_name,servings,prep_minutes,cook_minutes,ingredients,steps,tags,cuisine,image_url,status,review_notes,model,created_at',
      )
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const recipes: Recipe[] = [];
      for (const row of data) {
        if (!row || typeof row !== 'object') continue;
        const parsed = rowFromDb(row as Record<string, unknown>);
        if (parsed?.status === 'published') recipes.push(libraryRowToAppRecipe(parsed));
      }
      writeCache(recipes);
      return recipes;
    }
  }

  if (SUPABASE_URL.trim() && SUPABASE_ANON_KEY.trim()) {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${LIBRARY_RECIPES.table}?status=eq.published&select=id,slug,title,dish_name,servings,prep_minutes,cook_minutes,ingredients,steps,tags,cuisine,image_url,status,review_notes,model,created_at&order=created_at.desc`;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>[];
      const recipes: Recipe[] = [];
      for (const row of data) {
        const parsed = rowFromDb(row);
        if (parsed?.status === 'published') recipes.push(libraryRowToAppRecipe(parsed));
      }
      writeCache(recipes);
      return recipes;
    }
  }

  writeCache([]);
  return [];
}
