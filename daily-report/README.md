# Daily report (separate app)

Field daily reports with local accounts, IndexedDB, a service worker, and Excel import/export. This is **not** the MealPrep kitchen board (`New/kitchen.html` is unchanged).

Excel remains the system of record for billing, bids, and reports. This PR is UI + local data only. Google Drive/Sheets calls are stubbed.

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

Chrome/Edge give the best offline + folder experience (File System Access API). Use localhost or HTTPS so the service worker can register.

## Google env vars (later — leave empty now)

Do not put secrets in git. Copy `config.example.js` over local edits to `config.js`, or set these when a backend exists:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Identity Services (Web OAuth client). Maps to `googleClientId` in `config.js`. If empty, sign-in uses a **local/mock** Google session plus local named accounts. |
| `GOOGLE_API_KEY` | Drive/Sheets/Maps API key later (`googleApiKey`). |
| `GOOGLE_DRIVE_FOLDER_ID` | Shared Drive/folder to sync workbooks (`googleDriveFolderId`). |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Spreadsheet that is the cloud copy of the billing book (`googleSheetsSpreadsheetId`). |
| `GOOGLE_MAPS_API_KEY` | Optional later reverse-geocode of the pin. |

`.env.example` in this folder lists the same names. The current UI never invents or requires a live client secret.

## What works offline

- Multiple device accounts (local + mock Google; real GIS button when a client ID is present)
- Create/edit reports: weather, geolocation (when allowed), date/time, job name/number, crew, hours, materials, equipment, delays, safety, photos, supervisor, signature
- Saves to IndexedDB without a network
- Outbox queues upserts and flushes to a **local mirror** when online (Drive upload not wired)
- Export / import `.xlsx` (SheetJS). Chromium can link a workbook and grant a folder.

## Tests

```bash
node daily-report/model.test.js
```
