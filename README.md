# 209 Meal Prep

Static kitchen + ordering site. Customer menu lives on `New/index.html`. The kitchen board is `New/kitchen.html`.

## Recipe lab

The kitchen **Recipe lab** is the business bot for 209 Meal Prep:

- Create and iterate recipes (ingredients, yields, portion size, costs)
- Type your own nutrition values; they override sourced numbers without erasing them
- Look up USDA FoodData Central items, stored as durable records (source, citation, URL, timestamp, values)
- Save several local store websites and plan shopping trips grouped by store
- Export CSV and `.xlsx` workbooks for recipes, ingredients, input-vs-sourced nutrition, sourced records, and shopping trips

Public weekly menu still uses the same catalog, availability toggles, and order flow.

## API keys (do not commit secrets)

USDA FoodData Central needs a free [data.gov API key](https://fdc.nal.usda.gov/api-key-signup).

Option A — local server env var (preferred):

```bash
cp .env.example .env
# edit .env and set USDA_FDC_API_KEY
node server.mjs
```

Then open http://localhost:4173/kitchen.html

Option B — paste the key on the kitchen Recipe lab “USDA key” field. It stays in this browser’s localStorage only.

Option C — copy `New/config.example.js` to `New/config.js` and set `usdaApiKey`. `config.js` should not receive a real key in git.

If no key is set, lookups try USDA `DEMO_KEY` (strict rate limits).

Shopping trip planning uses the store URLs you enter plus recipe ingredient records. It does not scrape store websites.

## Data on this device

Same pattern as orders and sold-out flags: recipes, records, stores, and trips save in `localStorage` on the kitchen device until a shared backend is added.
