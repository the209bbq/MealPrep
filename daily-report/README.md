# Daily report (separate app)

Field daily reports: accounts, report list, and the jobsite form. This is **not** the MealPrep kitchen board (`New/kitchen.html` is unchanged).

This PR owns the **form UI and local report records**. Workbooks, Drive/folder access, and the offline outbox/sync queue are follow-on work.

## Run

From the repo root:

```bash
node daily-report/serve.mjs
```

Open **http://localhost:4174/**

Or serve both apps with the existing static server:

```bash
node server.mjs
```

- Kitchen / menu: http://localhost:4173/
- Daily report: http://localhost:4173/daily-report/

Use localhost or HTTPS so the service worker can register (app shell cache only).

## Google env vars (later — leave empty now)

Do not put secrets in git. Local sign-in works without them. Copy `config.example.js` into local edits of `config.js` when you have a Web OAuth client.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Identity Services (Web OAuth client). Maps to `googleClientId` in `config.js`. If empty, sign-in uses a **local/mock** Google session plus local named accounts. |

Drive/Sheets/Maps keys (`GOOGLE_API_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_MAPS_API_KEY`) are listed in `.env.example` for a later Excel/sync branch. This UI does not use them.

## What this app does

- Multiple device accounts (local + mock Google; real GIS button when a client ID is present)
- List, search, new, and edit daily reports
- Fields: weather, geolocation (when allowed), date/time, job name/number, crew, hours, materials, equipment, delays, safety, photos, supervisor, signature
- Saves to IndexedDB on this device (no network required)

## Tests

```bash
node daily-report/model.test.js
```
