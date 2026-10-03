import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIso8601DurationToMinutes, parseRecipeYieldToServings } from '../supabase/functions/recipe-import/durationParse.ts';
import {
  findRecipeJsonLdInHtml,
  recipeJsonLdToExtracted,
} from '../supabase/functions/recipe-import/jsonLdParser.ts';
import { validateGeminiRecipeImportPayload } from '../supabase/functions/recipe-import/recipeImportSchema.ts';
import {
  canonicalYouTubeWatchUrl,
  classifyRecipeImportUrl,
  normalizeImportUrl,
} from '../supabase/functions/recipe-import/urlClassification.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../test-fixtures/recipe-import-jsonld');

assert.equal(parseIso8601DurationToMinutes('PT15M'), 15);
assert.equal(parseIso8601DurationToMinutes('PT1H30M'), 90);
assert.equal(parseRecipeYieldToServings('6 servings'), 6);
assert.equal(parseRecipeYieldToServings(['4', '6']), 4);

assert.equal(classifyRecipeImportUrl('https://www.youtube.com/watch?v=abc'), 'youtube');
assert.equal(classifyRecipeImportUrl('https://youtu.be/abc'), 'youtube');
assert.equal(classifyRecipeImportUrl('https://www.allrecipes.com/recipe/1/'), 'web');
assert.equal(
  canonicalYouTubeWatchUrl('https://youtu.be/xyz123'),
  'https://www.youtube.com/watch?v=xyz123',
);

const normalized = normalizeImportUrl('allrecipes.com/recipe/123');
assert.ok(normalized?.startsWith('https://'));

const graphFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'allrecipes-graph.json'), 'utf8'),
);
const graphHtml = `<html><script type="application/ld+json">${JSON.stringify(graphFixture)}</script></html>`;
const graphNode = findRecipeJsonLdInHtml(graphHtml);
assert.ok(graphNode);
const graphRecipe = recipeJsonLdToExtracted(graphNode!, 'https://example.com/garlic-bread');
assert.ok(graphRecipe);
assert.equal(graphRecipe!.title, 'Easy Garlic Bread');
assert.equal(graphRecipe!.ingredients.length, 3);
assert.equal(graphRecipe!.steps.length, 2);
assert.equal(graphRecipe!.prep_minutes, 10);
assert.equal(graphRecipe!.cook_minutes, 12);

const sectionFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'howto-section.json'), 'utf8'),
);
const sectionRecipe = recipeJsonLdToExtracted(sectionFixture, 'https://example.com/soup');
assert.ok(sectionRecipe);
assert.equal(sectionRecipe!.steps.length, 2);
assert.equal(sectionRecipe!.servings, 4);

const geminiPayload = validateGeminiRecipeImportPayload({
  title: 'Test',
  servings: 2,
  prep_minutes: 5,
  cook_minutes: 10,
  ingredients: [{ name: 'salt', quantity: 1, unit: 'tsp' }],
  steps: ['Mix', 'Serve'],
  is_recipe: true,
  confidence: 0.8,
});
assert.ok(geminiPayload);
assert.equal(geminiPayload!.ingredients[0].name, 'salt');

const rejected = validateGeminiRecipeImportPayload({ title: '' });
assert.equal(rejected, null);

console.log('OK: recipe-import checks passed');
