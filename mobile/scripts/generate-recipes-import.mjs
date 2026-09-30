#!/usr/bin/env node
/**
 * Regenerates mobile/supabase/recipes_import.sql from kitchenCatalog.ts.
 * Run from repo root: node --experimental-strip-types mobile/scripts/generate-recipes-import.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.join(__dirname, '..');

const { KITCHEN_CATALOG } = await import(path.join(mobileRoot, 'data', 'kitchenCatalog.ts'));

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

const valueRows = KITCHEN_CATALOG.map((entry) => {
  return `  (
    ${sqlString(entry.slug)},
    ${sqlString(entry.name)},
    ${sqlString(entry.tag)},
    ${sqlString(entry.description)},
    ${entry.servings},
    ${entry.minutes},
    ${entry.calories},
    ${entry.protein},
    ${entry.carbs},
    ${entry.fat},
    true,
    ${sqlJson(entry.ingredients)},
    ${sqlJson(entry.steps)}
  )`;
}).join(',\n');

const sql = `-- 209 Meal Prep — kitchen catalog import (idempotent)
-- Paste into Supabase SQL Editor after setup.sql. Safe to re-run.
-- Adds carbs/fat columns and upserts all recipes from New/recipes.js RECIPE_CATALOG.

alter table public.recipes add column if not exists carbs int not null default 0;
alter table public.recipes add column if not exists fat int not null default 0;
alter table public.recipes add column if not exists nutrition_source text default '';
alter table public.recipes add column if not exists nutrition_citation text default '';
alter table public.recipes add column if not exists nutrition_sourced_at timestamptz;

insert into public.recipes (
  slug, name, tag, description, servings, minutes, calories, protein, carbs, fat,
  is_master, ingredients, steps
)
values
${valueRows}
on conflict (slug) do update set
  name = excluded.name,
  tag = excluded.tag,
  description = excluded.description,
  servings = excluded.servings,
  minutes = excluded.minutes,
  calories = excluded.calories,
  protein = excluded.protein,
  carbs = excluded.carbs,
  fat = excluded.fat,
  is_master = excluded.is_master,
  ingredients = excluded.ingredients,
  steps = excluded.steps;
`;

const outPath = path.join(mobileRoot, 'supabase', 'recipes_import.sql');
fs.writeFileSync(outPath, sql);
console.log(`Wrote ${outPath} (${KITCHEN_CATALOG.length} recipes)`);
