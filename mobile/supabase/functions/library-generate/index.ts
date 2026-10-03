// MealPlanatic library recipe generator (service role / admin secret only).
//
// Deploy: supabase functions deploy library-generate --no-verify-jwt
// Secrets: LIBRARY_ADMIN_SECRET, GEMINI_API_KEY
// Optional: GEMINI_MODEL, GEMINI_IMAGE_MODEL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { authorizeLibraryGenerate } from './auth.ts';
import { DEFAULT_BATCH_SIZE, geminiImageModel, geminiTextModel, MAX_BATCH_SIZE } from './config.ts';
import { generateAndStoreRecipeImage } from './geminiImage.ts';
import { criticLibraryRecipe, generateLibraryRecipe, type GeminiQuotaKind } from './geminiRecipe.ts';
import { slugifyLibraryDishName } from './slug.ts';
import type { RecipeImportExtracted } from '../recipe-import/recipeImportSchema.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-library-admin-secret',
};

interface QueueRow {
  dish_name: string;
  status: string;
  attempts: number;
}

interface ProcessResult {
  dish_name: string;
  slug: string;
  status: 'published' | 'rejected' | 'failed';
  notes?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recipeToRow(
  slug: string,
  dishName: string,
  recipe: RecipeImportExtracted,
  status: 'published' | 'rejected',
  reviewNotes: string | null,
  model: string,
  imageUrl: string | null,
) {
  return {
    slug,
    title: recipe.title.trim() || dishName,
    dish_name: dishName,
    servings: recipe.servings,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tags: [] as string[],
    cuisine: null as string | null,
    image_url: imageUrl,
    status,
    review_notes: reviewNotes,
    model,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = await authorizeLibraryGenerate(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = (Deno.env.get('GEMINI_API_KEY') ?? '').trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase service role not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let batchSize = DEFAULT_BATCH_SIZE;
  try {
    const body = (await req.json()) as { batchSize?: number };
    if (typeof body.batchSize === 'number' && Number.isFinite(body.batchSize)) {
      batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.round(body.batchSize)));
    }
  } catch {
    /* default batch */
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const textModel = geminiTextModel();
  const imageModel = geminiImageModel();

  const { data: queueRows, error: queueError } = await admin
    .from('library_dish_queue')
    .select('dish_name,status,attempts')
    .eq('status', 'pending')
    .order('dish_name', { ascending: true })
    .limit(batchSize);

  if (queueError) {
    return new Response(JSON.stringify({ error: queueError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: ProcessResult[] = [];
  let stopForDay = false;
  let quotaKind: GeminiQuotaKind = 'none';

  for (const row of (queueRows ?? []) as QueueRow[]) {
    if (stopForDay) break;

    const dishName = row.dish_name;
    const slug = slugifyLibraryDishName(dishName);
    if (!slug) {
      await admin
        .from('library_dish_queue')
        .update({ status: 'failed', last_error: 'Invalid dish name', attempts: row.attempts + 1 })
        .eq('dish_name', dishName);
      results.push({ dish_name: dishName, slug: '', status: 'failed', notes: 'Invalid dish name' });
      continue;
    }

    await admin
      .from('library_dish_queue')
      .update({ status: 'processing', attempts: row.attempts + 1 })
      .eq('dish_name', dishName);

    const generated = await generateLibraryRecipe(apiKey, textModel, dishName);
    if (!generated.ok) {
      quotaKind = generated.quota;
      if (generated.quota === 'quota_exhausted') stopForDay = true;
      if (generated.quota === 'rate_limit') await sleep(8_000);
      await admin
        .from('library_dish_queue')
        .update({
          status: generated.quota === 'quota_exhausted' ? 'pending' : 'failed',
          last_error: generated.detail,
        })
        .eq('dish_name', dishName);
      results.push({ dish_name: dishName, slug, status: 'failed', notes: generated.detail });
      continue;
    }

    const critic = await criticLibraryRecipe(apiKey, textModel, dishName, generated.data);
    if (!critic.ok) {
      quotaKind = critic.quota;
      if (critic.quota === 'quota_exhausted') stopForDay = true;
      if (critic.quota === 'rate_limit') await sleep(8_000);
      await admin
        .from('library_dish_queue')
        .update({ status: 'pending', last_error: critic.detail })
        .eq('dish_name', dishName);
      results.push({ dish_name: dishName, slug, status: 'failed', notes: critic.detail });
      continue;
    }

    const finalRecipe = critic.data.recipe;
    const approved = critic.data.approve;
    const reviewNotes = approved
      ? (critic.data.issues.length > 0 ? critic.data.issues.join('; ') : null)
      : [...critic.data.issues, 'Critic rejected'].join('; ');

    let imageUrl: string | null = null;
    if (approved) {
      const image = await generateAndStoreRecipeImage({
        apiKey,
        imageModel,
        supabaseUrl,
        serviceKey,
        slug,
        title: finalRecipe.title,
      });
      if (image.quota === 'quota_exhausted') {
        stopForDay = true;
      } else if (image.quota === 'rate_limit') {
        await sleep(8_000);
      }
      imageUrl = image.result?.publicUrl ?? null;
    }

    const status = approved ? 'published' : 'rejected';
    const upsertPayload = recipeToRow(
      slug,
      dishName,
      finalRecipe,
      status,
      reviewNotes,
      textModel,
      imageUrl,
    );

    const { error: upsertError } = await admin.from('library_recipes').upsert(upsertPayload, {
      onConflict: 'slug',
    });

    if (upsertError) {
      await admin
        .from('library_dish_queue')
        .update({ status: 'failed', last_error: upsertError.message })
        .eq('dish_name', dishName);
      results.push({ dish_name: dishName, slug, status: 'failed', notes: upsertError.message });
      continue;
    }

    await admin
      .from('library_dish_queue')
      .update({ status: 'done', last_error: null })
      .eq('dish_name', dishName);

    results.push({ dish_name: dishName, slug, status, notes: reviewNotes ?? undefined });

    await sleep(1_500);
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      results,
      stopForDay,
      quotaKind,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
