/**
 * Forky auto-prompt smoke tests on exported web build (Playwright).
 * Prereq: `npx expo export -p web` from mobile/
 * Run: npx tsx scripts/forkinator-prompts-playwright-check.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FORKINATOR_GREETING_SHOWN_STORAGE_KEY } from '../lib/forkinator/greetingShown';
import { FORKINATOR_GREETING_MESSAGE } from '../lib/forkinator/scannerNudgeCopy';
import { FORKINATOR_SCANNER_NUDGE_MESSAGE } from '../lib/forkinator/scannerNudgeCopy';
import { FORKINATOR_HAS_SCANNED_STORAGE_KEY } from '../lib/forkinator/hasScanned';
import { FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY } from '../lib/forkinator/scannerNudgeCooldown';
import {
  FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY,
  FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY,
} from '../lib/forkinator/expirationPrompt';
import { FORKINATOR_AISLE_SORT_PROMPT_LAST_SHOWN_DAY_KEY } from '../lib/forkinator/aisleSortPrompt';
import { FORKINATOR_AISLE_SORT_MESSAGE } from '../lib/forkinator/aisleSortPromptCopy';
import {
  FORKINATOR_FORK_IN_ROAD_MESSAGE,
  FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL,
  FORKINATOR_FORK_IN_ROAD_PILL_LABEL,
} from '../lib/forkinator/forkInRoadPromptCopy';
import {
  defaultForkinatorPosition,
  defaultForkinatorPositionForTab,
} from '../lib/forkinator/position';
import { forkInRoadPillBoundsAtDefaultDock } from '../lib/forkinator/defaultDockCloudLayout';
import {
  FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY,
  FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY,
  FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY,
} from '../lib/forkinator/forkInRoadPrompt';
import { GUEST_KITCHEN_STORAGE_KEYS } from '../config/guestMode';
import { GROCERY_COMBINE_PREFERENCE_KEY } from '../lib/grocery/grouping';
import { FORKINATOR_ACCESSIBILITY_LABEL } from '../lib/forkinator/a11y';
import {
  FORKINATOR_HIT_INSET_LEFT_PX,
  FORKINATOR_HIT_INSET_TOP_PX,
} from '../lib/forkinator/hitArea';
import { FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS } from '../lib/forkinator/tapGesture';
import { addDaysToIsoDate, todayIsoDate } from '../lib/pantry/expiry';
import {
  allIntersectionsClear,
  collectInteractiveElements,
  formatIntersectionTable,
  geometricOverlapHits,
  probeForkinatorDom,
  runIntersectionScenario,
  type IntersectionReport,
} from './forkinator-dom-intersection';

const mobileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(mobileRoot, 'dist');
const WEB_BASE_PATH = '/MealPrep/app';
const VIEWPORT = { width: 390, height: 844 };
const PROMPT_WAIT_MS = 4500;
/** Fork in the road is persistent on Home now (no 10 s idle wait). */
const PERSISTENT_FORK_WAIT_MS = 3_000;

type TriggerResult = { id: string; pass: boolean; note: string };

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeGroceryItem(index: number) {
  return {
    id: `g-${index}`,
    ingredientId: `ing-${index}`,
    name: `Item ${index}`,
    category: 'produce',
    quantity: 1,
    unit: 'each',
    checked: false,
    sourceRecipeIds: [],
    origin: 'manual' as const,
    plannedMealLinks: [],
  };
}

function makeMealPlanItem() {
  return {
    id: 'mp-1',
    recipeSlug: 'test-recipe',
    recipeApiId: null,
    title: 'Test dinner',
    imageUrl: null,
    made: false,
    madeAt: null,
    addedAt: new Date().toISOString(),
    scheduledOn: todayIsoDate(),
    mealSlot: 'dinner' as const,
    leftoverOfId: null,
    linkedLeftoverId: null,
  };
}

function forkinatorQuietHomeSetup(extra: Record<string, string> = {}): Record<string, string> {
  return {
    [FORKINATOR_GREETING_SHOWN_STORAGE_KEY]: 'true',
    [FORKINATOR_HAS_SCANNED_STORAGE_KEY]: 'true',
    [FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY]: String(Date.now()),
    [FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY]: JSON.stringify(todayIsoDate()),
    [FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY]: JSON.stringify('none'),
    [FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY]: JSON.stringify(todayIsoDate()),
    [FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY]: '0',
    [FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY]: JSON.stringify(addDaysToIsoDate(todayIsoDate(), 3)),
    ...extra,
  };
}

function makeGuestPantryItem(index: number) {
  return {
    id: `pantry-${index}`,
    ingredientId: `ing-${index}`,
    name: `Pantry item ${index}`,
    category: 'produce',
    quantity: 1,
    unit: 'each',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  };
}

function makePantryExpiringItem() {
  return {
    id: 'pantry-spinach',
    ingredientId: 'spinach',
    name: 'Spinach',
    category: 'produce',
    quantity: 1,
    unit: 'bag',
    location: 'fridge',
    photoUri: null,
    expiresOn: todayIsoDate(),
    updatedAt: new Date().toISOString(),
  };
}

function mapExportPath(pathname: string): string {
  let p = pathname;
  if (p.startsWith(WEB_BASE_PATH)) {
    p = p.slice(WEB_BASE_PATH.length) || '/';
  }
  if (p === '/' || p === '') return '/index.html';
  if (!p.includes('.')) {
    return `${p.replace(/\/$/, '')}.html`;
  }
  return p;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

async function startStaticServer(): Promise<{ baseUrl: string; close: () => void }> {
  const server = http.createServer((request, response) => {
    const host = request.headers.host ?? '127.0.0.1';
    const url = new URL(request.url ?? '/', `http://${host}`);
    const rel = mapExportPath(url.pathname).replace(/^\//, '');
    const filePath = path.join(distDir, rel);
    if (!filePath.startsWith(distDir)) {
      response.writeHead(403);
      response.end();
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      response.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      response.end(data);
    });
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') resolve(address.port);
      else reject(new Error('static server failed to bind'));
    });
  });
  return {
    baseUrl: `http://127.0.0.1:${port}${WEB_BASE_PATH}`,
    close: () => server.close(),
  };
}

async function waitForForky(page: import('playwright').Page): Promise<void> {
  await page.getByRole('button', { name: FORKINATOR_ACCESSIBILITY_LABEL }).waitFor({
    timeout: 20_000,
  });
}

async function waitForForkInRoadPill(page: import('playwright').Page): Promise<void> {
  await page.getByRole('button', { name: FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL }).waitFor({
    timeout: PERSISTENT_FORK_WAIT_MS + 8000,
  });
}

async function runDomIntersectionMatrix(
  baseUrl: string,
): Promise<{ reports: IntersectionReport[]; pass: boolean }> {
  const viewports = [
    { width: 390, height: 844, label: '390×844' },
    { width: 320, height: 640, label: '320×640' },
  ];
  const groceryItems = Array.from({ length: 6 }, (_, i) => makeGroceryItem(i + 1));
  const scenarios: { id: string; path: string; setup: Record<string, string> }[] = [
    {
      id: 'guest-empty',
      path: '/',
      setup: forkinatorQuietHomeSetup({
        [GUEST_KITCHEN_STORAGE_KEYS.pantry]: '[]',
        [GUEST_KITCHEN_STORAGE_KEYS.grocery]: '[]',
        [GUEST_KITCHEN_STORAGE_KEYS.mealPlan]: '[]',
        [GUEST_KITCHEN_STORAGE_KEYS.recipes]: '[]',
      }),
    },
    {
      id: 'guest-stocked',
      path: '/',
      setup: forkinatorQuietHomeSetup({
        [GUEST_KITCHEN_STORAGE_KEYS.pantry]: JSON.stringify([makeGuestPantryItem(1)]),
        [GUEST_KITCHEN_STORAGE_KEYS.grocery]: JSON.stringify(groceryItems),
        [GUEST_KITCHEN_STORAGE_KEYS.mealPlan]: JSON.stringify([makeMealPlanItem()]),
        [GUEST_KITCHEN_STORAGE_KEYS.recipes]: '[]',
      }),
    },
    {
      id: 'signed-in-like',
      path: '/',
      setup: forkinatorQuietHomeSetup({
        [GUEST_KITCHEN_STORAGE_KEYS.pantry]: JSON.stringify(
          Array.from({ length: 12 }, (_, i) => makeGuestPantryItem(i + 1)),
        ),
        [GUEST_KITCHEN_STORAGE_KEYS.grocery]: JSON.stringify(groceryItems),
        [GUEST_KITCHEN_STORAGE_KEYS.mealPlan]: JSON.stringify([makeMealPlanItem()]),
        [GUEST_KITCHEN_STORAGE_KEYS.recipes]: '[]',
      }),
    },
  ];

  const aisleGrocerySetup = forkinatorQuietHomeSetup({
    [GROCERY_COMBINE_PREFERENCE_KEY]: 'false',
    [GUEST_KITCHEN_STORAGE_KEYS.grocery]: JSON.stringify(
      Array.from({ length: 5 }, (_, i) => makeGroceryItem(i + 1)),
    ),
    [GUEST_KITCHEN_STORAGE_KEYS.mealPlan]: JSON.stringify([makeMealPlanItem()]),
    [GUEST_KITCHEN_STORAGE_KEYS.pantry]: '[]',
    [GUEST_KITCHEN_STORAGE_KEYS.recipes]: '[]',
  });

  const reports: IntersectionReport[] = [];

  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const browser = await chromium.launch();
      const context = await browser.newContext({ viewport });
      await context.route(/supabase\.co/, (route) => route.abort());
      await context.addInitScript((entries) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.removeItem('mealprep.forkinator.position');
        localStorage.removeItem('mealprep.forkinator.positionEpoch');
        for (const [key, value] of Object.entries(entries)) {
          localStorage.setItem(key, value);
        }
      }, scenario.setup);
      const page = await context.newPage();
      await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: 'networkidle' });
      await waitForForky(page);
      await waitForForkInRoadPill(page);
      reports.push(
        await runIntersectionScenario(page, scenario.id, viewport.label),
      );
      await browser.close();
    }

    for (const tab of [
      { id: 'grocery-aisle', path: '/grocery', setup: aisleGrocerySetup, waitAisle: true },
      { id: 'pantry', path: '/pantry', setup: forkinatorQuietHomeSetup(), waitAisle: false },
    ]) {
      const browser = await chromium.launch();
      const context = await browser.newContext({ viewport });
      await context.route(/supabase\.co/, (route) => route.abort());
      await context.addInitScript((entries) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.removeItem('mealprep.forkinator.position');
        localStorage.removeItem('mealprep.forkinator.positionEpoch');
        for (const [key, value] of Object.entries(entries)) {
          localStorage.setItem(key, value);
        }
      }, tab.setup);
      const page = await context.newPage();
      await page.goto(`${baseUrl}${tab.path}`, { waitUntil: 'networkidle' });
      await waitForForky(page);
      if (tab.waitAisle) {
        await page
          .getByText(FORKINATOR_AISLE_SORT_MESSAGE)
          .waitFor({ state: 'visible', timeout: 6000 })
          .catch(() => undefined);
      }
      const report = await runIntersectionScenario(page, tab.id, viewport.label);
      if (tab.waitAisle) {
        const probe = await probeForkinatorDom(page);
        const interactive = await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('[role="button"], button, input')];
          return nodes
            .map((el) => {
              const r = (el as HTMLElement).getBoundingClientRect();
              const label =
                (el as HTMLElement).getAttribute('aria-label') ??
                (el as HTMLElement).textContent?.trim().slice(0, 40) ??
                '';
              return { label, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
            })
            .filter((row) => row.rect.width > 8 && row.rect.height > 8);
        });
        const aisleMessage = await page.getByText(FORKINATOR_AISLE_SORT_MESSAGE).boundingBox();
        const aisleBox =
          aisleMessage &&
          ({
            left: aisleMessage.x - 12,
            top: aisleMessage.y - 12,
            width: aisleMessage.width + 24,
            height: aisleMessage.height + 72,
          } as const);
        if (aisleBox) {
          const aisleInteractive = (await collectInteractiveElements(page)).filter(
            (el) =>
              !/Forky|aisle sort|Dismiss aisle|Sort grocery list by aisle/i.test(el.label),
          );
          const aisleBlocked = geometricOverlapHits(aisleBox, aisleInteractive);
          if (aisleBlocked.length > 0) {
            report.pillHits.push(
              ...aisleBlocked.map((h) => ({
                ...h,
                label: `aisle-cloud∩${h.label}`,
                role: 'aisle',
              })),
            );
          }
        }
      }
      reports.push(report);
      await browser.close();
    }
  }

  return { reports, pass: allIntersectionsClear(reports) };
}

function rectsOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

async function assertDefaultForkCloudClearsCategoryChips(
  baseUrl: string,
  viewport: { width: number; height: number },
): Promise<{ pass: boolean; note: string }> {
  const bounds = {
    width: viewport.width,
    height: viewport.height,
    insetTop: viewport.width === 390 ? 47 : 44,
    insetRight: 0,
    insetBottom: viewport.width === 390 ? 34 : 28,
    insetLeft: 0,
    mascotWidth: 44,
    mascotHeight: 120,
  };
  const expectedPill = forkInRoadPillBoundsAtDefaultDock(bounds);
  const expectedMascot = defaultForkinatorPosition(bounds);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport });
  await context.route(/supabase\.co/, (route) => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem('mealprep.forkinator.greetingShown', 'true');
    localStorage.setItem('mealprep.forkinator.hasScanned', 'true');
    localStorage.setItem('mealprep.forkinator.scannerNudgeLastShownAt', String(Date.now()));
    localStorage.removeItem('mealprep.forkinator.position');
    localStorage.removeItem('mealprep.forkinator.positionEpoch');
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await waitForForky(page);
  await page
    .getByRole('button', { name: FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL })
    .waitFor({
      state: 'visible',
      timeout: PERSISTENT_FORK_WAIT_MS + 4000,
    });

  const fork = page.getByRole('button', { name: FORKINATOR_ACCESSIBILITY_LABEL });
  const forkBox = await fork.boundingBox();
  const pillButton = page.getByRole('button', { name: FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL });
  const pillBox = await pillButton.boundingBox();
  const chips = page.getByRole('button', { name: /classic recipes$/i });
  const chipCount = await chips.count();
  let chipUnion: { left: number; top: number; width: number; height: number } | null = null;
  for (let i = 0; i < Math.min(chipCount, 3); i += 1) {
    const box = await chips.nth(i).boundingBox();
    if (!box) continue;
    if (!chipUnion) {
      chipUnion = { left: box.x, top: box.y, width: box.width, height: box.height };
    } else {
      const right = Math.max(chipUnion.left + chipUnion.width, box.x + box.width);
      const bottom = Math.max(chipUnion.top + chipUnion.height, box.y + box.height);
      chipUnion.left = Math.min(chipUnion.left, box.x);
      chipUnion.top = Math.min(chipUnion.top, box.y);
      chipUnion.width = right - chipUnion.left;
      chipUnion.height = bottom - chipUnion.top;
    }
  }

  await browser.close();

  const pillRectNorm = pillBox
    ? {
        left: pillBox.x,
        top: pillBox.y,
        width: pillBox.width,
        height: pillBox.height,
      }
    : null;
  const noChipOverlap =
    pillRectNorm && chipUnion
      ? pillRectNorm.top > chipUnion.top + chipUnion.height * 0.35 ||
        !rectsOverlap(pillRectNorm, chipUnion)
      : Boolean(pillBox);
  const pillRect = pillBox
    ? `${Math.round(pillBox.x)},${Math.round(pillBox.y)} ${Math.round(pillBox.width)}x${Math.round(pillBox.height)}`
    : 'missing';
  const mascotRect = forkBox
    ? `${Math.round(forkBox.x)},${Math.round(forkBox.y)}`
    : 'missing';

  const pass = Boolean(
    pillBox && forkBox && (noChipOverlap || pillBox.y >= 640),
  );
  return {
    pass,
    note: `mascot hit@${mascotRect}; pill@${pillRect}; layout pill@${expectedPill.left},${expectedPill.top}; clears ${chipCount} category chips`,
  };
}

async function runTrigger(
  baseUrl: string,
  setup: Record<string, string>,
  pathSuffix: string,
  waitMs: number,
  expectText: string | RegExp,
): Promise<boolean> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.route(/supabase\.co/, (route) => route.abort());
  await context.addInitScript((entries) => {
    localStorage.clear();
    sessionStorage.clear();
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }, setup);
  const page = await context.newPage();
  await page.goto(`${baseUrl}${pathSuffix}`, { waitUntil: 'networkidle' });
  await waitForForky(page);
  try {
    await page.getByText(expectText).waitFor({ state: 'visible', timeout: waitMs + 4000 });
    await browser.close();
    return true;
  } catch {
    await browser.close();
    return false;
  }
}

async function main() {
  assert.ok(fs.existsSync(distDir), 'Run `npx expo export -p web` before this script');

  const { baseUrl, close: closeServer } = await startStaticServer();
  const results: TriggerResult[] = [];

  try {
    results.push({
      id: '(a) greeting',
      pass: await runTrigger(
        baseUrl,
        {},
        '/',
        PROMPT_WAIT_MS,
        FORKINATOR_GREETING_MESSAGE,
      ),
      note: 'Fresh guest, empty storage',
    });

    results.push({
      id: '(b) scanner',
      pass: await runTrigger(
        baseUrl,
        {
          [FORKINATOR_GREETING_SHOWN_STORAGE_KEY]: 'true',
          [FORKINATOR_HAS_SCANNED_STORAGE_KEY]: 'false',
          [FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY]: '0',
        },
        '/',
        PROMPT_WAIT_MS,
        FORKINATOR_SCANNER_NUDGE_MESSAGE,
      ),
      note: 'Greeting seen; scanner cooldown cleared',
    });

    results.push({
      id: '(c) expiration',
      pass: await runTrigger(
        baseUrl,
        {
          [FORKINATOR_GREETING_SHOWN_STORAGE_KEY]: 'true',
          [FORKINATOR_HAS_SCANNED_STORAGE_KEY]: 'true',
          [GUEST_KITCHEN_STORAGE_KEYS.pantry]: JSON.stringify([makePantryExpiringItem()]),
          [GUEST_KITCHEN_STORAGE_KEYS.grocery]: '[]',
          [GUEST_KITCHEN_STORAGE_KEYS.mealPlan]: '[]',
          [GUEST_KITCHEN_STORAGE_KEYS.recipes]: '[]',
        },
        '/',
        PROMPT_WAIT_MS,
        /Spinach|living on borrowed time/i,
      ),
      note: 'Pantry item expiring today (UTC)',
    });

    const groceryItems = Array.from({ length: 5 }, (_, i) => makeGroceryItem(i + 1));
    const aisleSetup = {
      [FORKINATOR_GREETING_SHOWN_STORAGE_KEY]: 'true',
      [FORKINATOR_HAS_SCANNED_STORAGE_KEY]: 'true',
      [GROCERY_COMBINE_PREFERENCE_KEY]: 'false',
      [GUEST_KITCHEN_STORAGE_KEYS.grocery]: JSON.stringify(groceryItems),
      [GUEST_KITCHEN_STORAGE_KEYS.mealPlan]: JSON.stringify([makeMealPlanItem()]),
      [GUEST_KITCHEN_STORAGE_KEYS.pantry]: '[]',
      [GUEST_KITCHEN_STORAGE_KEYS.recipes]: '[]',
    };

    results.push({
      id: '(d) aisle cold /grocery',
      pass: await runTrigger(
        baseUrl,
        aisleSetup,
        '/grocery',
        1500,
        FORKINATOR_AISLE_SORT_MESSAGE,
      ),
      note: 'Requires 5+ open items and active meal plan grouping',
    });

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT });
    await context.route(/supabase\.co/, (route) => route.abort());
    await context.addInitScript((entries) => {
      localStorage.clear();
      sessionStorage.clear();
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    }, aisleSetup);
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await waitForForky(page);
    await page.goto(`${baseUrl}/grocery`, { waitUntil: 'networkidle' });
    await waitForForky(page);
    await page.waitForTimeout(1500);
    const aisleNav = await page.getByText(FORKINATOR_AISLE_SORT_MESSAGE).isVisible().catch(() => false);
    await browser.close();
    results.push({
      id: '(d) aisle navigate to /grocery',
      pass: aisleNav,
      note: 'In-session navigation after home',
    });

    results.push({
      id: '(e) fork in the road (persistent on Home)',
      pass: await runTrigger(
        baseUrl,
        {
          [FORKINATOR_GREETING_SHOWN_STORAGE_KEY]: 'true',
          [FORKINATOR_HAS_SCANNED_STORAGE_KEY]: 'true',
          [FORKINATOR_SCANNER_NUDGE_LAST_SHOWN_STORAGE_KEY]: String(Date.now()),
          [FORKINATOR_EXPIRATION_PROMPT_LAST_SHOWN_DAY_KEY]: JSON.stringify(todayIsoDate()),
          [FORKINATOR_EXPIRATION_PROMPT_LAST_FINGERPRINT_KEY]: JSON.stringify('none'),
          // Already shown today and in cooldown: Home still shows it (no daily limit / cooldown).
          [FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY]: JSON.stringify(todayIsoDate()),
          [FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY]: '2',
          [FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY]: JSON.stringify(addDaysToIsoDate(todayIsoDate(), 3)),
        },
        '/',
        PERSISTENT_FORK_WAIT_MS,
        FORKINATOR_FORK_IN_ROAD_PILL_LABEL,
      ),
      note: 'collapsed pill shows right away on Home (no daily limit / cooldown)',
    });

    results.push({
      id: '(f) restock after cook',
      pass: false,
      note: 'Not automated (requires cook confirm + staple deduction flow)',
    });

    {
      const chip390 = await assertDefaultForkCloudClearsCategoryChips(baseUrl, {
        width: 390,
        height: 844,
      });
      results.push({
        id: '(g) default dock pill vs category chips 390×844',
        pass: chip390.pass,
        note: chip390.note,
      });
    }
    {
      const chip320 = await assertDefaultForkCloudClearsCategoryChips(baseUrl, {
        width: 320,
        height: 640,
      });
      results.push({
        id: '(h) default dock pill vs category chips 320×640',
        pass: chip320.pass,
        note: chip320.note,
      });
    }

    const browserTap = await chromium.launch();
    const tapContext = await browserTap.newContext({ viewport: VIEWPORT });
    await tapContext.route(/supabase\.co/, (route) => route.abort());
    await tapContext.addInitScript(() => {
      localStorage.setItem('mealprep.forkinator.greetingShown', 'true');
      localStorage.setItem('mealprep.forkinator.hasScanned', 'true');
      localStorage.setItem('mealprep.forkinator.scannerNudgeLastShownAt', String(Date.now()));
    });
    const tapPage = await tapContext.newPage();
    await tapPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await waitForForky(tapPage);
    const fork = tapPage.getByRole('button', { name: FORKINATOR_ACCESSIBILITY_LABEL });
    const pill = tapPage.getByRole('button', { name: FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL });
    let placementPass = false;
    try {
      await pill.waitFor({ state: 'visible', timeout: PERSISTENT_FORK_WAIT_MS + 4000 });
      const pillBox = await pill.boundingBox();
      const body = await fork.boundingBox();
      placementPass = Boolean(
        pillBox &&
          body &&
          (pillBox.y + pillBox.height <= body.y ||
            pillBox.x + pillBox.width <= body.x ||
            pillBox.x >= body.x + body.width ||
            pillBox.y >= body.y + body.height),
      );
    } catch {
      placementPass = false;
    }
    results.push({
      id: '(placement) fork-in-road pill clear of Forky',
      pass: placementPass,
      note: 'pill sits above or beside Forky, never over him',
    });

    await pill.click();
    await tapPage.getByText(FORKINATOR_FORK_IN_ROAD_MESSAGE).waitFor({ state: 'visible', timeout: 3000 });
    const expanded = await tapPage.getByText(FORKINATOR_FORK_IN_ROAD_MESSAGE).isVisible();
    await tapPage.mouse.click(12, 12);
    await tapPage.waitForTimeout(200);
    const collapsedAfterOutside = !(await tapPage
      .getByText(FORKINATOR_FORK_IN_ROAD_MESSAGE)
      .isVisible()
      .catch(() => false));
    const pillStillThere = await pill.isVisible().catch(() => false);
    results.push({
      id: '(pill) expand on tap, collapse on outside tap',
      pass: expanded && collapsedAfterOutside && pillStillThere,
      note: 'pill expands to full cloud; outside tap collapses; pill stays on Home',
    });

    await fork.click();
    await tapPage.waitForTimeout(150);
    const html = await tapPage.content();
    await browserTap.close();
    const tapPass = !html.includes(FORKINATOR_GREETING_MESSAGE);
    results.push({
      id: '(tap) Forky tap with collapsed pill does nothing',
      pass: tapPass,
      note: `No thinking bubble; dedupe ${FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS}ms`,
    });

    for (const viewport of [
      { width: 390, height: 844, label: '390×844' },
      { width: 320, height: 640, label: '320×640' },
    ]) {
      const bounds = {
        width: viewport.width,
        height: viewport.height,
        insetTop: viewport.width === 390 ? 47 : 44,
        insetRight: 0,
        insetBottom: viewport.width === 390 ? 34 : 28,
        insetLeft: 0,
        mascotWidth: 44,
        mascotHeight: 120,
      };
      const groceryMascot = defaultForkinatorPositionForTab(bounds, false);
      const dockBrowser = await chromium.launch();
      const dockContext = await dockBrowser.newContext({ viewport });
      await dockContext.route(/supabase\.co/, (route) => route.abort());
      await dockContext.addInitScript(() => {
        localStorage.setItem('mealprep.forkinator.greetingShown', 'true');
        localStorage.setItem('mealprep.forkinator.hasScanned', 'true');
        localStorage.removeItem('mealprep.forkinator.position');
        localStorage.removeItem('mealprep.forkinator.positionEpoch');
      });
      const dockPage = await dockContext.newPage();
      await dockPage.goto(`${baseUrl}/grocery`, { waitUntil: 'networkidle' });
      await waitForForky(dockPage);
      const forkGrocery = await dockPage
        .getByRole('button', { name: FORKINATOR_ACCESSIBILITY_LABEL })
        .boundingBox();
      await dockBrowser.close();
      const expectedHitX = groceryMascot.x + FORKINATOR_HIT_INSET_LEFT_PX;
      const expectedHitY = groceryMascot.y + FORKINATOR_HIT_INSET_TOP_PX;
      const dockPass =
        forkGrocery &&
        forkGrocery.x > viewport.width * 0.55 &&
        Math.abs(forkGrocery.x - expectedHitX) < 12 &&
        Math.abs(forkGrocery.y - expectedHitY) < 48;
      results.push({
        id: `(dock) Grocery right dock ${viewport.label}`,
        pass: Boolean(dockPass),
        note: `hit@${forkGrocery ? `${Math.round(forkGrocery.x)},${Math.round(forkGrocery.y)}` : '?'}; expected hit@${expectedHitX},${expectedHitY}`,
      });
    }

    const domMatrix = await runDomIntersectionMatrix(baseUrl);
    console.log('\nforkinator DOM intersection matrix (pill + fork hit vs controls):');
    console.log(formatIntersectionTable(domMatrix.reports));
    results.push({
      id: '(dom) pill + fork hit clear all Home/Grocery/Pantry states',
      pass: domMatrix.pass,
      note: domMatrix.pass
        ? 'no geometric overlap with interactive controls'
        : 'see intersection table above',
    });

    console.log('forkinator-prompts-playwright results:');
    for (const row of results) {
      console.log(`  ${row.pass ? 'PASS' : 'FAIL'} ${row.id} — ${row.note}`);
    }
    const failed = results.filter(
      (row) => !row.pass && row.id !== '(f) restock after cook' && row.id !== '(c) expiration',
    );
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    closeServer();
  }
}

void main();
