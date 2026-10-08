# MealPlanatic mobile (Expo)

Expo Router app with NativeWind styling and optional Supabase auth. The web build is exported to GitHub Pages at the root of https://mealplanatic.app; the static site in `New/` is published under `/209/`.

## Run on your phone with Expo Go (no paid accounts)

1. Install [Expo Go](https://expo.dev/go) on iOS or Android.
2. From this folder:

   ```bash
   npm ci
   npx expo start
   ```

3. Scan the QR code with the camera (iOS) or Expo Go (Android). Your phone and computer must be on the same Wi‑Fi unless you use tunnel mode (`npx expo start --tunnel`).

Supabase env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) enable live auth and data; without them the app runs in demo mode with local mock storage.

## Install the web app (PWA) on your home screen

Production build: **https://mealplanatic.app/**

- **Android (Chrome):** open the URL, use the install banner or browser menu → “Install app”.
- **iOS (Safari):** open the URL → Share → **Add to Home Screen**.

The PWA uses a service worker for fast loads and basic offline access to the app shell. Supabase API and auth traffic are never cached.

### Build web export locally

```bash
npm run export:web
```

Output is in `dist/`. The `export:web` script regenerates brand icons from `assets/mealplanatic-logo-source.png` (`npm run generate:brand`), writes PWA icons/manifest (`generate:pwa`), runs `expo export -p web`, then patches the service worker precache list.

## Future: App Store / Play Store builds (EAS)

When you are ready for store builds (Apple Developer / Google Play accounts):

1. Install EAS CLI: `npx eas-cli@latest login`
2. Configure `eas.json` in this project (`eas build:configure`).
3. Create development builds for device testing: `eas build --profile development --platform ios|android`
4. Production releases: `eas build --profile production` then `eas submit`

Expo Go cannot load arbitrary native modules; a dev build replaces Expo Go for full native feature testing. OTA updates use `eas update` after the first store build.

This repo does not configure EAS or paid developer accounts yet.

## Smart Shop / live store prices

See [docs/SMART_SHOP.md](./docs/SMART_SHOP.md) for free Kroger API setup, Supabase Edge Function deploy, and env vars.
