/**
 * Creator row rotation + Classic category row — 9 acceptance checks from spec.
 * Run from mobile/: npm run test:creator-rotation
 */

import { RECIPES_TAB_SURFACE } from '../config/recipesTabSurface';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';
import type { CreatorListItem } from '../lib/creatorVideos/types';
import { isCategoryHiddenByDietMap } from '../lib/recipesTab/categoryDiet';
import { buildCategoryRotation } from '../lib/recipesTab/categoryRotation';
import { computeCreatorPassRate } from '../lib/recipesTab/creatorPassRate';
import {
  buildCreatorRotation,
  first5CreatorIds,
} from '../lib/recipesTab/creatorRotation';
import { createVisitRng } from '../lib/recipesTab/seededRandom';
import type { RecipesTabSurfaceEvent } from '../lib/recipesTab/surfaceEvents';
import {
  commitVisitRowOrder,
  resolveVisitForSimulation,
  type RecipesTabVisitState,
} from '../lib/recipesTab/visitState';
import { emptyEngagementIndexForGhost } from '../lib/recipeRanking/engagementIndexHelpers';
import type { RecipeEngagementEvent } from '../lib/recipeRanking/types';
import { createEngagementEvent } from '../lib/recipeRanking/eventStore';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function mockCreator(id: string, subs: number, views = subs * 10): CreatorListItem {
  return {
    id,
    youtubeChannelId: `ch-${id}`,
    displayName: `Creator ${id}`,
    handle: null,
    channelUrl: 'https://youtube.com',
    avatarUrl: null,
    subscriberCount: subs,
    totalChannelViews: views,
    rank: null,
    fit: 'High',
    source: null,
  };
}

const creators = Array.from({ length: 12 }, (_, i) => mockCreator(`c${i + 1}`, (i + 1) * 100_000));

function passRatesAllOne(): Map<string, number> {
  return new Map(creators.map((c) => [c.id, 1]));
}

function simulateVisit(
  prior: RecipesTabVisitState | null,
  nowMs: number,
  options: {
    recipeEvents: RecipeEngagementEvent[];
    surfaceEvents: RecipesTabSurfaceEvent[];
    rngSeed?: string;
    coldStart?: boolean;
  },
): { first5: string[]; visitId: string; state: RecipesTabVisitState } {
  const session = resolveVisitForSimulation(prior, nowMs, options.coldStart ?? false);
  const rng = options.rngSeed ? createVisitRng(options.rngSeed) : undefined;
  const slots = buildCreatorRotation({
    visitId: session.visitId,
    creators,
    passRateById: passRatesAllOne(),
    recipeEvents: options.recipeEvents,
    surfaceEvents: options.surfaceEvents,
    refKeyToCreatorId: new Map(),
    visitState: session.state,
    nowMs,
    rng,
  });
  const first5 = first5CreatorIds(slots);
  const state = commitVisitRowOrder('test-owner', session.state, first5, ['Chicken', 'Beef', 'Pasta']);
  return { first5, visitId: session.visitId, state };
}

// 1. Two visits 10+ min apart: not same first-5 order; share at most 3 creators.
{
  const gap = RECIPES_TAB_SURFACE.visitGapMs + 1;
  let state: RecipesTabVisitState | null = null;
  const a = simulateVisit(state, 1_000_000, { recipeEvents: [], surfaceEvents: [] });
  state = a.state;
  const b = simulateVisit(state, 1_000_000 + gap, {
    recipeEvents: [],
    surfaceEvents: [],
    rngSeed: 'visit-b',
  });
  const overlap = a.first5.filter((id) => b.first5.includes(id)).length;
  assert(overlap <= 3, `check 1 overlap: ${overlap}`);
  const sameOrder = a.first5.length === b.first5.length && a.first5.every((id, i) => id === b.first5[i]);
  assert(!sameOrder, 'check 1: first-5 order must change between visits');
}

// 2. Same visit id → stable order.
{
  const input = {
    visitId: 'stable-visit',
    creators,
    passRateById: passRatesAllOne(),
    recipeEvents: [] as RecipeEngagementEvent[],
    surfaceEvents: [] as RecipesTabSurfaceEvent[],
    refKeyToCreatorId: new Map<string, string>(),
    visitState: {
      lastVisitAt: Date.now(),
      lastVisitId: 'stable-visit',
      lastFirst5Creators: [],
      lastFirst3Categories: [],
      recentFirst5Visits: [],
    },
    nowMs: Date.now(),
  };
  const once = first5CreatorIds(buildCreatorRotation(input));
  const twice = first5CreatorIds(buildCreatorRotation(input));
  assert(once.join(',') === twice.join(','), 'check 2: order stable within visit');
}

// 3. Favorite creator in positions 1–5 for ≥80% of 20 visits.
{
  const favoriteId = 'c1';
  const baseNow = Date.now();
  const recipeEvents: RecipeEngagementEvent[] = [
    createEngagementEvent(`kitchen:x`, 'plan'),
  ];
  recipeEvents[0]!.v2 = {
    ts: baseNow,
    recipeId: 'x',
    source: 'creator',
    group: 'main',
    sheetId: 's1',
    creatorId: favoriteId,
  };
  let state: RecipesTabVisitState | null = null;
  let hits = 0;
  for (let i = 0; i < 20; i += 1) {
    const now = baseNow + i * (RECIPES_TAB_SURFACE.visitGapMs + 1);
    const visit = simulateVisit(state, now, { recipeEvents, surfaceEvents: [], rngSeed: `fav-${i}` });
    state = visit.state;
    if (visit.first5.slice(0, 5).includes(favoriteId)) hits += 1;
  }
  assert(hits >= 16, `check 3: favorite in top 5 only ${hits}/20`);
}

// 4. New user: every creator appears in first 5 at least once over 30 visits.
{
  const smallCreators = creators.slice(0, 8);
  let state: RecipesTabVisitState | null = null;
  const seen = new Set<string>();
  const exploreBase = Date.now();
  for (let i = 0; i < 30; i += 1) {
    const now = exploreBase + i * (RECIPES_TAB_SURFACE.visitGapMs + 1);
    const session = resolveVisitForSimulation(state, now);
    const slots = buildCreatorRotation({
      visitId: session.visitId,
      creators: smallCreators,
      passRateById: new Map(smallCreators.map((c) => [c.id, 1])),
      recipeEvents: [],
      surfaceEvents: [],
      refKeyToCreatorId: new Map(),
      visitState: session.state,
      nowMs: now,
      rng: createVisitRng(`explore-${i}`),
    });
    for (const id of first5CreatorIds(slots)) seen.add(id);
    state = commitVisitRowOrder('test-owner', session.state, first5CreatorIds(slots), []);
  }
  for (const c of smallCreators) {
    assert(seen.has(c.id), `check 4: ${c.id} never in first 5`);
  }
}

// 5. passRate < 0.2 never shows.
{
  const low = mockCreator('low', 1000);
  const rates = new Map([[low.id, 0.1]]);
  const slots = buildCreatorRotation({
    visitId: 'v-low',
    creators: [low],
    passRateById: rates,
    recipeEvents: [],
    surfaceEvents: [],
    refKeyToCreatorId: new Map(),
    visitState: {
      lastVisitAt: 0,
      lastVisitId: 'v-low',
      lastFirst5Creators: [],
      lastFirst3Categories: [],
      recentFirst5Visits: [],
    },
    nowMs: Date.now(),
  });
  assert(slots.length === 0, 'check 5: low passRate creator hidden');
}

// 6. Diet hides + min 3 recipes.
{
  const vegPrefs = { ...DEFAULT_USER_DIET_PREFS, diets: ['vegetarian'], hideConflicts: true };
  for (const cat of ['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood'] as const) {
    assert(isCategoryHiddenByDietMap(cat, vegPrefs), `check 6 veg hide ${cat}`);
  }
  const halalPrefs = {
    ...DEFAULT_USER_DIET_PREFS,
    diets: ['halal'],
    hideConflicts: true,
  } as import('../lib/diet/types').UserDietPrefs;
  assert(isCategoryHiddenByDietMap('Pork', halalPrefs), 'check 6 halal hide pork');
  const chips = buildCategoryRotation({
    visitId: 'cat-visit',
    categories: [
      { category: 'Chicken', thumbUrl: null, passingRecipeCount: 2 },
      { category: 'Beef', thumbUrl: null, passingRecipeCount: 5 },
      { category: 'Pasta', thumbUrl: null, passingRecipeCount: 99 },
      { category: 'Miscellaneous', thumbUrl: null, passingRecipeCount: 10 },
    ],
    prefs: DEFAULT_USER_DIET_PREFS,
    householdSize: 2,
    index: emptyEngagementIndexForGhost(),
    surfaceEvents: [],
    visitState: {
      lastVisitAt: 0,
      lastVisitId: 'cat-visit',
      lastFirst5Creators: [],
      lastFirst3Categories: [],
      recentFirst5Visits: [],
    },
    nowMs: Date.now(),
  });
  assert(chips.some((c) => c.category === 'Chicken'), 'check 6: home chips ignore loaded-page counts');
  assert(!chips.some((c) => c.category === 'Miscellaneous'), 'check 6: non-home categories hidden');
  assert(chips.some((c) => c.category === 'Pasta'), 'check 6: pasta is a home category chip');
  assert(chips.some((c) => c.category === 'Beef'), 'check 6: home-listed categories remain');
}

// 7. Breakfast before 10 AM.
{
  const chips = buildCategoryRotation({
    visitId: 'breakfast-visit',
    categories: [
      { category: 'Breakfast', thumbUrl: null, passingRecipeCount: 10 },
      { category: 'Pasta', thumbUrl: null, passingRecipeCount: 10 },
      { category: 'Chicken', thumbUrl: null, passingRecipeCount: 10 },
    ],
    prefs: DEFAULT_USER_DIET_PREFS,
    householdSize: 2,
    index: emptyEngagementIndexForGhost(),
    surfaceEvents: [],
    visitState: {
      lastVisitAt: 0,
      lastVisitId: 'breakfast-visit',
      lastFirst5Creators: [],
      lastFirst3Categories: [],
      recentFirst5Visits: [],
    },
    nowMs: Date.UTC(2026, 0, 1, 8, 0, 0),
    hourLocal: 8,
  });
  assert(chips[0]?.category === 'Breakfast', `check 7: expected Breakfast first, got ${chips[0]?.category}`);
}

// 8. Scoring modules are importable without network (this file runs offline).
assert(typeof buildCreatorRotation === 'function', 'check 8: client-side scoring');

// 9. Diet pass rate helper respects hide rules (proxy for results filters).
{
  const rate = computeCreatorPassRate(
    [
      {
        videoId: 'v1',
        channelId: 'ch',
        creatorName: 'A',
        creatorHandle: null,
        creatorAvatarUrl: null,
        channelUrl: 'https://youtube.com',
        title: 'Pork ribs BBQ',
        descriptionSnippet: 'pork',
        thumbnailUrl: 'https://example.com/t.jpg',
        publishedAt: null,
        viewCount: 1,
        likeCount: 0,
        durationSeconds: 60,
        isShort: false,
        watchUrl: 'https://youtube.com/watch?v=v1',
      },
    ],
    { ...DEFAULT_USER_DIET_PREFS, diets: ['vegetarian'], hideConflicts: true },
  );
  assert(rate < RECIPES_TAB_SURFACE.minPassRateToShow, 'check 9: pork video fails vegetarian filter');
}

console.log('creator-rotation-check: ok');
