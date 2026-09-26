# Daily report (separate app)

Field daily reports with local accounts, IndexedDB, a service worker, and Excel import/export. This is **not** the MealPrep kitchen board (`New/kitchen.html` is unchanged).

Excel is the system of record for **billing, bids, and reports**. Import/export uses SheetJS (`Billing`, `Bids`, `Reports`, `Crew`, `Materials`, `Equipment` sheets). Chromium can link a workbook, create one, and grant a job folder (File System Access API). Google Drive/Sheets upload is a stub unless env keys exist — and even then this client does not call Google without a real OAuth token.

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

The Node servers inject those values into `config.js` **only when the env vars are set**. Empty env keeps the checked-in empty `config.js`. Never commit secrets.

## What works offline

- Multiple device accounts (`#/accounts`): local + mock Google; real GIS button when a client ID is present
- Create/edit reports: weather, geolocation (when allowed), date/time, job name/number, crew, hours, materials, equipment, delays, safety, photos, supervisor, signature
- Saves to IndexedDB without a network
- Outbox queues report/billing/bid upserts and auto-flushes when online (Background Sync when available). Without Google keys the remote is a **local IndexedDB mirror**
- Export / import `.xlsx` including billing + bids. Chromium can link/create a workbook and save into a granted folder.

## Tests

```bash
node daily-report/model.test.js
node daily-report/config-from-env.test.mjs
```
