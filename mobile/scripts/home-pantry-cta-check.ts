/**
 * Home Pantry CTA: copy, navigation target, and placement below catalog bars.
 * Run from mobile/: npm run test:home-pantry-cta
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ROUTES } from '../config/appRoutes';
import { RECIPES_COPY } from '../config/recipesCopy';

assert.equal(
  RECIPES_COPY.homePantryPrompt.description,
  "Add what's in your kitchen — recipes will match what you have, and your grocery list skips it.",
);
assert.equal(RECIPES_COPY.homePantryPrompt.buttonLabel, 'Go to Pantry');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

const ctaSource = fs.readFileSync(
  path.join(mobileRoot, 'components/home/HomePantryCta.tsx'),
  'utf8',
);
assert.match(ctaSource, /RECIPES_COPY\.homePantryPrompt/, 'cta should use home copy config');
assert.match(
  ctaSource,
  /router\.push\(APP_ROUTES\.pantry\)/,
  'button should navigate to pantry tab',
);
assert.match(ctaSource, /accessibilityRole="button"/);
assert.match(ctaSource, /accessibilityLabel=\{buttonLabel\}/);
assert.match(ctaSource, /pressed \? 0\.88/, 'button should have pressed opacity feedback');

const homeSource = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/index.tsx'), 'utf8');
const creatorsBarIndex = homeSource.indexOf('CREATOR_RECIPES_COPY.creatorsSectionTitle');
const pantryCtaIndex = homeSource.indexOf('<HomePantryCta');
assert.ok(creatorsBarIndex >= 0, 'home should render creators collapsible bar');
assert.ok(pantryCtaIndex >= 0, 'home should render HomePantryCta');
assert.ok(
  pantryCtaIndex > creatorsBarIndex,
  'pantry CTA should appear after the creator recipes bar',
);
const creatorsSectionClose = homeSource.indexOf('</RecipesTabCollapsibleSection>', creatorsBarIndex);
assert.ok(creatorsSectionClose >= 0 && creatorsSectionClose < pantryCtaIndex, 'cta below creators bar');

assert.equal(APP_ROUTES.pantry, '/pantry');

console.log('home-pantry-cta-check: ok');
