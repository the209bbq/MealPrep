/**
 * Manual eval: run fixture pantry photos against deployed pantry-vision and score recall/precision.
 * Requires secrets (not run in CI):
 *   SUPABASE_URL, SUPABASE_ANON_KEY or user JWT via PANTRY_VISION_JWT
 *
 * Run from mobile/: npm run eval:pantry-vision-photos
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalIngredientPhrase, fuzzyNameScore } from '../lib/recipeMatch/ingredientNormalize';
import { parsePantryVisionPayload } from '../lib/pantryVision/detectionParse';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(scriptDir, '../test/fixtures/photos');
const groundTruthPath = join(fixturesDir, 'ground-truth.json');

type GroundTruthFile = Record<
  string,
  { scanLocation: string; expectedIngredients: string[] }
>;

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

function matchExpected(detectedPhrase: string, expected: string): boolean {
  if (!detectedPhrase || !expected) return false;
  const expectedPhrase = canonicalIngredientPhrase(expected);
  if (detectedPhrase === expectedPhrase) return true;
  if (detectedPhrase.includes(expectedPhrase) || expectedPhrase.includes(detectedPhrase)) return true;
  return fuzzyNameScore(detectedPhrase, expected) >= 0.72;
}

async function scanPhoto(
  supabaseUrl: string,
  jwt: string,
  fileName: string,
  scanLocation: string,
): Promise<string[]> {
  const bytes = readFileSync(join(fixturesDir, fileName));
  const base64 = bytes.toString('base64');
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/pantry-vision`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType: 'image/jpeg',
      location: scanLocation,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`pantry-vision ${response.status}: ${text.slice(0, 400)}`);
  }
  const payload = JSON.parse(text) as unknown;
  const rows = parsePantryVisionPayload(payload);
  return rows.map((row) => canonicalIngredientPhrase(row.name)).filter(Boolean);
}

async function main(): Promise<void> {
  const supabaseUrl = env('SUPABASE_URL');
  const jwt = process.env.PANTRY_VISION_JWT?.trim() || env('SUPABASE_USER_JWT');
  const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf8')) as GroundTruthFile;

  for (const [fileName, spec] of Object.entries(groundTruth)) {
    const detected = await scanPhoto(supabaseUrl, jwt, fileName, spec.scanLocation);
    const detectedSet = new Set(detected);
    let hits = 0;
    const missed: string[] = [];
    for (const expected of spec.expectedIngredients) {
      const found = [...detectedSet].some((d) => matchExpected(d, expected));
      if (found) hits += 1;
      else missed.push(expected);
    }
    const recall = hits / spec.expectedIngredients.length;
    const precision = detected.length > 0 ? hits / detected.length : 0;
    console.log(`\n${fileName}`);
    console.log(`  detected: ${detected.length} items`);
    console.log(`  recall: ${(recall * 100).toFixed(1)}% (${hits}/${spec.expectedIngredients.length})`);
    console.log(`  precision (vs ground truth list): ${(precision * 100).toFixed(1)}%`);
    if (missed.length > 0) {
      console.log(`  missed: ${missed.join(', ')}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
