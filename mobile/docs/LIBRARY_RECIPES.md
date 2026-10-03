# MealPlanatic recipe library

Original recipes are generated into Supabase (`library_recipes`) and shown on the Recipes tab. RecipeAPI discovery is controlled by `mobile/config/recipeSources.ts`.

## Database

1. Apply migrations (SQL Editor or CLI):

```bash
cd mobile
supabase db push
# or run:
# mobile/supabase/migrations/20261003200000_library_recipes.sql
# mobile/supabase/migrations/20261003201000_library_dish_queue_seed.sql
```

## Edge function `library-generate`

**Secrets**

| Secret | Required | Notes |
|--------|----------|--------|
| `LIBRARY_ADMIN_SECRET` | Yes | Sent as header `x-library-admin-secret` from `library-run.ts` |
| `GEMINI_API_KEY` | Yes | Same key as pantry-vision / recipe-import |
| `GEMINI_MODEL` | No | Text model (default `gemini-2.0-flash`) |
| `GEMINI_IMAGE_MODEL` | No | Imagen model (default `imagen-3.0-generate-002`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Provided by Supabase in Edge Functions |

**Deploy**

```bash
cd mobile
supabase functions deploy library-generate --no-verify-jwt
supabase secrets set LIBRARY_ADMIN_SECRET="..." GEMINI_API_KEY="..." 
# optional:
supabase secrets set GEMINI_IMAGE_MODEL="imagen-3.0-generate-002"
```

Admin users may also call the function with a Bearer session JWT (profile `role = admin`).

## Batch generation

Small batches respect Gemini free-tier limits (429 backoff, quota stop):

```bash
cd mobile
SUPABASE_URL="https://okkwapgyadpaifpmkcex.supabase.co" \
LIBRARY_ADMIN_SECRET="..." \
npx tsx scripts/library-run.ts --batches 10 --batch-size 1
```

Images land in the public bucket `library-recipe-images`; `image_url` on each published row points at the object URL.

## App config

- `RECIPE_SOURCES.recipeApiEnabled` — pause RecipeAPI feed/search
- `RECIPE_SOURCES.libraryRecipesEnabled` — load published library rows (anon read via RLS)
