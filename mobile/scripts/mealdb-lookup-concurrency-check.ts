import assert from 'node:assert/strict';
import type { MealDbMealsResponse } from '../lib/mealdb/types';
import { resetMealDbClientCacheForTests, mealDbLookupMeals } from '../lib/mealdb/client';

const delayMs = 80;
const concurrencyLimit = 6;

let inFlight = 0;
let maxInFlight = 0;

function minimalMeal(id: string): MealDbMealsResponse {
  return {
    meals: [
      {
        idMeal: id,
        strMeal: `Meal ${id}`,
        strCategory: 'Chicken',
        strArea: 'American',
        strInstructions: 'Cook.',
        strMealThumb: 'https://example.com/thumb.jpg',
        strTags: null,
        strYoutube: null,
        strSource: null,
      },
    ],
  };
}

const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  assert.match(url, /lookup\.php\?i=/);
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  inFlight -= 1;
  const id = new URL(url).searchParams.get('i') ?? '0';
  return {
    ok: true,
    json: async () => minimalMeal(id),
  } as Response;
}) as typeof fetch;

resetMealDbClientCacheForTests();

async function main(): Promise<void> {
  const ids = Array.from({ length: 12 }, (_, index) => String(52800 + index));
  const started = Date.now();
  const meals = await mealDbLookupMeals(ids, { concurrency: concurrencyLimit });
  const elapsedMs = Date.now() - started;

  assert.equal(meals.length, ids.length);
  assert.ok(maxInFlight <= concurrencyLimit, `expected max ${concurrencyLimit}, saw ${maxInFlight}`);
  const sequentialMs = ids.length * delayMs;
  assert.ok(
    elapsedMs < sequentialMs * 0.6,
    `expected parallel fetch (~${Math.ceil((ids.length / concurrencyLimit) * delayMs)}ms), took ${elapsedMs}ms`,
  );

  globalThis.fetch = originalFetch;
  resetMealDbClientCacheForTests();
  console.log('mealdb-lookup-concurrency-check ok');
}

void main();
