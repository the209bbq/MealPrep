# 209 Meal Prep

Static kitchen + ordering site. Customer menu is `New/index.html`. Kitchen board is `New/kitchen.html` (Menu, Recipes, Shopping, Orders).

## Recipes (kitchen board)

The **Recipes** tab is part of the kitchen board — not a separate bot or CLI.

- Enter ingredients, costs, yields, and nutrition values on the same card-style layout as weekly menu controls
- USDA FoodData Central lookups attach cited sourced nutrition; your typed costs and overrides stay
- Every save/lookup is a durable record (origin, citation, timestamp)
- Export CSV + `.xlsx` for recipes, ingredients, input-vs-sourced nutrition, and records
- Menu tab **Edit recipe** opens that meal on Recipes

Public weekly menu and checkout are unchanged aside from extra macros when a recipe has them.

## API keys (do not commit secrets)

USDA FoodData Central needs a free [data.gov API key](https://fdc.nal.usda.gov/api-key-signup).

```bash
cp .env.example .env
# set USDA_FDC_API_KEY
node server.mjs
```

Or paste the key on the Recipes tab (this device only). Empty key tries USDA `DEMO_KEY` (rate limited).
