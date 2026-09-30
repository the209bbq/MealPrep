# Recipe discovery (RecipeAPI.io)

The mobile app searches [RecipeAPI.io](https://recipeapi.io) through a Supabase Edge Function so the API key never ships in the client.

## Owner setup

1. Create an API key at [recipeapi.io](https://recipeapi.io) (starts with `sk_live_`).
2. In the Supabase project: **Edge Functions → Secrets** → add `RECIPEAPI_KEY` with that value.
3. Deploy the function:
   ```bash
   cd mobile
   supabase functions deploy recipeapi-proxy --project-ref <your-project-ref>
   ```
4. Run the SQL migration `supabase/migrations/20260930210000_recipe_discovery_user_recipes.sql` in the SQL editor (or `supabase db push`) so members can save personal imports.
5. Ensure users sign in before searching (the proxy verifies the Supabase JWT).

Optional: set `EXPO_PUBLIC_RECIPEAPI_PROXY_URL` if the function URL differs from `{SUPABASE_URL}/functions/v1/recipeapi-proxy`.

## Free tier

RecipeAPI.io free plans allow **500 requests/month**. The app debounces search and caches list/detail responses in memory on the client and server.

## Demo mode

Without Supabase env vars, the Discover screen shows clearly labeled **demo sample** recipes only.
