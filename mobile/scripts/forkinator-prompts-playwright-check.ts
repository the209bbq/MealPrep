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
import { FORKINATOR_FORK_IN_ROAD_MESSAGE } from '../lib/forkinator/forkInRoadPromptCopy';
import {
  FORKINATOR_FORK_IN_ROAD_COOLDOWN_UNTIL_DAY_KEY,
  FORKINATOR_FORK_IN_ROAD_CONSECUTIVE_DISMISSALS_KEY,
  FORKINATOR_FORK_IN_ROAD_LAST_SHOWN_DAY_KEY,
} from '../lib/forkinator/forkInRoadPrompt';
import { GUEST_KITCHEN_STORAGE_KEYS } from '../config/guestMode';
import { GROCERY_COMBINE_PREFERENCE_KEY } from '../lib/grocery/grouping';
import { FORKINATOR_ACCESSIBILITY_LABEL } from '../lib/forkinator/a11y';
import { FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS } from '../lib/forkinator/tapGesture';
import { addDaysToIsoDate, todayIsoDate } from '../lib/pantry/expiry';

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
        FORKINATOR_FORK_IN_ROAD_MESSAGE,
      ),
      note: 'shows right away on Home, ignoring the old idle wait, daily limit and cooldown',
    });

    results.push({
      id: '(f) restock after cook',
      pass: false,
      note: 'Not automated (requires cook confirm + staple deduction flow)',
    });

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
    const forkText = tapPage.getByText(FORKINATOR_FORK_IN_ROAD_MESSAGE);
    let placementPass = false;
    try {
      await forkText.waitFor({ state: 'visible', timeout: PERSISTENT_FORK_WAIT_MS + 4000 });
      const cloud = await forkText.boundingBox();
      const body = await fork.boundingBox();
      placementPass = Boolean(
        cloud &&
          body &&
          (cloud.y + cloud.height <= body.y ||
            cloud.x + cloud.width <= body.x ||
            cloud.x >= body.x + body.width ||
            cloud.y >= body.y + body.height),
      );
    } catch {
      placementPass = false;
    }
    results.push({
      id: '(placement) fork-in-road cloud clear of Forky',
      pass: placementPass,
      note: 'cloud text sits above or beside Forky, never over him',
    });
    await fork.click();
    await tapPage.waitForTimeout(150);
    const closedForVisit = !(await forkText.isVisible().catch(() => false));
    await fork.click();
    await tapPage.waitForTimeout(150);
    const html = await tapPage.content();
    const stillClosed = !(await forkText.isVisible().catch(() => false));
    await browserTap.close();
    const tapPass = closedForVisit && stillClosed && !html.includes(FORKINATOR_GREETING_MESSAGE);
    results.push({
      id: '(tap) close for visit, then tap does nothing',
      pass: tapPass,
      note: `First tap closes fork in the road for this visit; a tap with no prompt opens nothing (no thinking bubble; dedupe ${FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS}ms)`,
    });

    console.log('forkinator-prompts-playwright results:');
    for (const row of results) {
      console.log(`  ${row.pass ? 'PASS' : 'FAIL'} ${row.id} — ${row.note}`);
    }
    const failed = results.filter((row) => !row.pass && row.id !== '(f) restock after cook');
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    closeServer();
  }
}

void main();
