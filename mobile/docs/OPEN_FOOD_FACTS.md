# Open Food Facts (barcode lookup)

Free product data by barcode. No API key and no Supabase function: the app calls Open Food Facts directly so their rate limits apply per user device instead of one shared server IP.

## Where it lives

| Piece | File |
| --- | --- |
| Constants, copy, URLs | `config/openFoodFacts.ts` |
| Barcode validation (GTIN check digit, UPC-A padding) | `lib/openFoodFacts/barcode.ts` |
| Lookup client, parser, cache | `lib/openFoodFacts/client.ts` |
| Pantry UI (Add item sheet) | `components/pantry/PantryBarcodeLookup.tsx` |
| Required credit line | `components/pantry/OpenFoodFactsCreditLine.tsx` |
| Regression check | `scripts/open-food-facts-check.ts` (`npm run test:open-food-facts`) |

## Rules to keep

- **Identify the app.** Native requests send `MealPlanatic/1.0 (<support email>)` as the User-Agent. Browsers cannot set it, so web sends none. Make sure the support inbox in `config/support.ts` is real.
- **Rate limits.** Product reads: 15 requests/min per IP (per user when called from a device). Never use their search endpoint for search-as-you-type, and do not route lookups through a shared server.
- **Attribution.** Data is ODbL/DbCL and images are CC BY-SA. The credit line must appear wherever their data is shown. Do not copy their data into your own tables to keep without reading their Terms of Use first (share-alike).
- **Accuracy.** Data is community-contributed. Allergen text is shown with a "check the package" note.
- **Production host only.** `world.openfoodfacts.org`. The `.net` host is their staging server.

## Not done yet

- **Camera scanning.** Lookup works with a typed barcode. Scanning needs `expo-camera`, which must be added with `npx expo install expo-camera` (so the version matches the Expo SDK) plus a camera permission string in `app.json`.
- **Category and storage location.** Adding an item still infers category and location from the name, as before. Open Food Facts categories are not used yet.
- **Live API on web.** `world.openfoodfacts.org` returns `Access-Control-Allow-Origin: *`, so the GitHub Pages app can call the API from the browser. Still spot-check a real barcode after deploy; native uses the identifying User-Agent.
