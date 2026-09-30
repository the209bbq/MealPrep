# Smart Shop (store deals)

Smart Shop finds **real nearby grocery stores** (OpenStreetMap Overpass) and compares prices for your grocery list. Without Kroger API credentials it runs in **SAMPLE deals** mode (clearly labeled in the UI).

## Owner setup (no Supabase CLI)

1. **Run SQL** in the Supabase SQL editor (idempotent):

   `mobile/supabase/migrations/20260930400000_smart_shop_location_stores.sql`

   Adds home location columns on `profiles` and `user_favorite_stores` with RLS.

2. **Kroger Developer account (free)**  
   - [https://developer.kroger.com/](https://developer.kroger.com/)  
   - Create an app with **Product** and **Location** scopes.  
   - Note **Client ID** and **Client Secret**.

3. **Supabase Edge Function secrets**  
   In Dashboard → Edge Functions → Secrets:

   - `KROGER_CLIENT_ID`
   - `KROGER_CLIENT_SECRET`

4. **Deploy `kroger-deals`**  
   Paste the full contents of `mobile/supabase/functions/kroger-deals/index.ts` into the dashboard editor.  
   Name: `kroger-deals`. Leave **Verify JWT** ON.

5. **Web/PWA env** (GitHub Pages build or `mobile/.env`):

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://okkwapgyadpaifpmkcex.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   EXPO_PUBLIC_KROGER_CLIENT_ID=your_kroger_client_id
   ```

   Never put the client **secret** in the repo or web bundle.

6. **Rebuild web**: `cd mobile && npm run export:web`

## Architecture

- `lib/stores/` — Nominatim (ZIP → coords), Overpass (nearby supermarkets), optional Kroger location merge.  
- `lib/deals/` — `PricingProvider` interface; Kroger live prices + sample fallback.  
- `config/smartShop.ts` — radius, endpoints, User-Agent (OSM policy).  
- Location and favorite stores sync to Supabase when signed in; local cache for guests/demo.
