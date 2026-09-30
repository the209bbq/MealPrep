# Smart Shop (store deals)

Smart Shop compares prices for items on your grocery list. Without Kroger credentials it runs in **sample deals** mode (clearly labeled in the UI).

## Turn on live Kroger deals (free)

1. **Kroger Developer account (free)**  
   - Sign up at [https://developer.kroger.com/](https://developer.kroger.com/)  
   - Create an application and note the **Client ID** and **Client Secret**.  
   - Kroger covers Kroger-family banners (Kroger, Ralphs, Fred Meyer, etc.). It does **not** include Save Mart, FoodMaxx, or other non-Kroger chains.

2. **App environment (public, safe in the client)**  
   In `mobile/.env` (or your CI/GitHub Pages build secrets):

   ```env
   EXPO_PUBLIC_KROGER_CLIENT_ID=your_kroger_client_id
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

   Optional override if the function URL differs:

   ```env
   EXPO_PUBLIC_KROGER_PROXY_URL=https://your-project.supabase.co/functions/v1/kroger-deals
   ```

   Never commit the **client secret** to the repo or expose it in the web bundle.

3. **Supabase Edge Function (keeps the secret server-side)**  
   From the repo root (with [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in):

   ```bash
   cd mobile
   supabase secrets set KROGER_CLIENT_ID=your_kroger_client_id KROGER_CLIENT_SECRET=your_kroger_client_secret
   supabase functions deploy kroger-deals --project-ref YOUR_PROJECT_REF
   ```

   The function source is `mobile/supabase/functions/kroger-deals/index.ts`.  
   The mobile app calls it with the anon key in the `Authorization` header (standard Supabase pattern).

4. **Feature flag**  
   Smart Shop is enabled by default (`smartShop` in `config/appConfig.ts`). Admins can toggle it in the Admin tab when using Supabase feature flags.

5. **Rebuild / redeploy web**  

   ```bash
   cd mobile && npm run export:web
   ```

   Deploy the `dist/` output to GitHub Pages (or your host) so the PWA picks up env vars from the build.

## Architecture

- Typed providers live in `lib/deals/` (`PricingProvider` interface).  
- `sampleProvider` is always available for demos.  
- `krogerProvider` calls the Edge Function when `EXPO_PUBLIC_KROGER_CLIENT_ID` and Supabase URL are set.  
- Saved ZIP, GPS coords, and “My stores” persist locally via `lib/smartShop/storage.ts`.
