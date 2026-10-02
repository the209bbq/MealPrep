/**
 * Playwright E2E: pantry → recipes → grocery → Smart Shop (guest / demo web export).
 * Run from mobile/: npm run test:web-e2e
 */
import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_FLAG_DEFAULTS } from '../config/appConfig';
import { GUEST_SAVE_NUDGE_CONFIG } from '../config/guestSaveNudge';
import { GROCERY_COPY } from '../config/grocery';
import { RECIPES_COPY } from '../config/recipesCopy';
import { SMART_SHOP_COPY } from '../config/smartShop';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distDir = path.join(mobileRoot, 'dist');
const serveRoot = path.join(mobileRoot, '.e2e-serve-root');

const basePath = (process.env.APP_BASE ?? '/MealPrep/app').replace(/\/$/, '');
const port = Number(process.env.PORT ?? 8766);
const origin = `http://127.0.0.1:${port}`;

const PANTRY_ITEMS = [
  'canned beans',
  'pasta',
  'rice',
  'tomato sauce',
  'peanut butter',
  'broth',
  'tuna',
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function prepareServeRoot(): string {
  if (!fs.existsSync(distDir)) {
    console.error('Missing dist/ — run npm run export:web first.');
    process.exit(1);
  }
  const nested = path.join(serveRoot, basePath.replace(/^\//, ''));
  fs.rmSync(serveRoot, { recursive: true, force: true });
  fs.mkdirSync(nested, { recursive: true });
  for (const entry of fs.readdirSync(distDir)) {
    fs.cpSync(path.join(distDir, entry), path.join(nested, entry), { recursive: true });
  }
  return serveRoot;
}

function waitForHttpReady(): Promise<void> {
  const deadline = Date.now() + 30_000;
  const probe = `${origin}${basePath}/`;
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(probe)
        .then((res) => {
          if (res.ok) resolve();
          else if (Date.now() > deadline) reject(new Error(`Probe failed: ${res.status}`));
          else setTimeout(tick, 250);
        })
        .catch(() => {
          if (Date.now() > deadline) reject(new Error('Static server did not respond in time'));
          else setTimeout(tick, 250);
        });
    };
    tick();
  });
}

function startServer(): Promise<{ close: () => void }> {
  const root = prepareServeRoot();
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['serve', root, '-l', String(port), '--no-port-switching'], {
      cwd: mobileRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.on('error', reject);
    void waitForHttpReady()
      .then(() => {
        resolve({
          close: () => {
            proc.kill('SIGKILL');
          },
        });
      })
      .catch((err) => {
        proc.kill('SIGTERM');
        reject(err);
      });
  });
}

async function primeGuestSession(page: Page): Promise<void> {
  await page.goto(`${origin}${basePath}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.reload({ waitUntil: 'networkidle' });
  const lookAround = page.getByRole('button', { name: 'Look around first' });
  if (await lookAround.isVisible().catch(() => false)) {
    await lookAround.click({ force: true });
  }
  await page.getByRole('tab', { name: 'Pantry' }).waitFor({ timeout: 20_000 });
}

async function addPantryItems(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Pantry' }).click();
  await page.waitForURL(/\/pantry/, { timeout: 15_000 });

  for (const name of PANTRY_ITEMS) {
    await page.getByText('Add item manually', { exact: true }).click();
    await page.getByPlaceholder('Item name').fill(name);
    await page.getByText('Add to pantry', { exact: true }).click();
    await page.getByText(name, { exact: true }).waitFor({ timeout: 15_000 });
  }
}

/** Nudge is Home-only; demo/web E2E runs without Supabase (demo mode hides the nudge entirely). */
async function assertGuestSaveNudgeNotOnKitchenTabs(page: Page): Promise<void> {
  const message = GUEST_SAVE_NUDGE_CONFIG.copy.message;
  for (const tab of ['Pantry', 'Recipes', 'Grocery List'] as const) {
    await page.getByRole('tab', { name: tab }).click();
    const body = await page.locator('body').innerText();
    assert(!body.includes(message), `guest save nudge should not appear on ${tab}`);
  }
}

async function addMissingFromRecipes(page: Page): Promise<string> {
  await page.getByRole('tab', { name: 'Recipes' }).click();
  await page.waitForURL(/\/recipes/, { timeout: 15_000 });

  const addMissing = page.getByText(RECIPES_COPY.recipeCard.addMissingCta, { exact: true }).first();
  await addMissing.waitFor({ timeout: 30_000 });
  await addMissing.click();

  await page.getByText(GROCERY_COPY.viewGroceryListAction, { exact: true }).waitFor({ timeout: 10_000 });
  return GROCERY_COPY.viewGroceryListAction;
}

async function verifyGroceryList(page: Page): Promise<void> {
  await page.getByText(GROCERY_COPY.viewGroceryListAction, { exact: true }).click();
  await page.waitForURL(/\/grocery/, { timeout: 15_000 });

  await page.getByText(GROCERY_COPY.listTitle, { exact: true }).first().waitFor({ timeout: 10_000 });
  const body = (await page.locator('body').innerText()).toLowerCase();
  assert(body.includes('to buy'), 'grocery tab should show open items');
  assert(/\d+ to buy/.test(body), 'grocery tab should show open item count');

  assert(!/\bsalt\b/i.test(body), 'grocery list should skip staple salt');
  assert(!/\bolive oil\b/i.test(body), 'grocery list should skip staple oil');
}

async function smartShopWithMockStores(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('mealprep.smartShop.zip', JSON.stringify('95361'));
    localStorage.setItem(
      'mealprep.smartShop.coords',
      JSON.stringify({ lat: 37.7665, lng: -120.8471, updatedAt: new Date().toISOString() }),
    );
  });

  const shopCta = page.getByText(/Find stores for this list/, { exact: false }).first();
  await shopCta.waitFor({ timeout: 15_000 });
  await shopCta.click();
  await page.waitForURL(/\/smart-shop/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

  await page.waitForFunction(
    () => /Smart Shop|Compare at these stores|E2E Test Mart/i.test(document.body?.innerText ?? ''),
    { timeout: 30_000 },
  );

  const zipField = page.getByPlaceholder(SMART_SHOP_COPY.locationZipPlaceholder);
  if (await zipField.isVisible().catch(() => false)) {
    await zipField.fill('95361');
    await page.getByText(SMART_SHOP_COPY.locationContinue, { exact: true }).click();
    await page.waitForFunction(
      () => /Compare at these stores|E2E Test Mart/i.test(document.body?.innerText ?? ''),
      { timeout: 30_000 },
    );
  }

  await page.getByText('E2E Test Mart', { exact: true }).first().waitFor({ timeout: 45_000 });
  await page.getByText(/Shop whole list on Walmart/i).first().waitFor({ timeout: 45_000 });
  await page.getByText('Store site', { exact: true }).first().waitFor({ timeout: 15_000 });
}

async function verifyHomeMealCalendar(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.waitForURL(/\/?$|\/index/, { timeout: 15_000 });
  await page.getByText('This week', { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText('+ Add meal', { exact: true }).first().waitFor({ timeout: 10_000 });
}

async function runGuestFlow(page: Page): Promise<void> {
  await primeGuestSession(page);
  await addPantryItems(page);
  await verifyHomeMealCalendar(page);
  await assertGuestSaveNudgeNotOnKitchenTabs(page);
  await addMissingFromRecipes(page);
  await verifyGroceryList(page);
  await smartShopWithMockStores(page);
}

async function main(): Promise<void> {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addInitScript((flags) => {
      if (sessionStorage.getItem('mealprep.e2e.seeded') === '1') {
        return;
      }
      sessionStorage.setItem('mealprep.e2e.seeded', '1');
      localStorage.setItem('mealprep.onboarding.welcomeDismissed', 'true');
      localStorage.setItem('mealprep.onboarding.tourCompleted', 'true');
      localStorage.setItem('mealprep.onboarding.tourQueued', 'false');
      localStorage.setItem('mealprep.pantry', JSON.stringify([]));
      localStorage.setItem('mealprep.grocery', JSON.stringify([]));
      localStorage.setItem('mealprep.guest.pantry', JSON.stringify([]));
      localStorage.setItem('mealprep.guest.grocery', JSON.stringify([]));
      localStorage.setItem('mealprep.guest.mealPlan', JSON.stringify([]));
      localStorage.setItem('mealprep.guest.recipes', JSON.stringify([]));
      localStorage.setItem('mealprep.mealPlan', JSON.stringify([]));
      localStorage.setItem('mealprep.featureFlags', JSON.stringify(flags));
      localStorage.setItem('mealprep.smartShop.zip', JSON.stringify('95361'));
      localStorage.setItem(
        'mealprep.smartShop.coords',
        JSON.stringify({ lat: 37.7665, lng: -120.8471, updatedAt: new Date().toISOString() }),
      );
      localStorage.removeItem('mealprep.smartShop.savedStoreIds');
      localStorage.removeItem('mealprep.smartShop.savedStores');
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('mealprep.osmCache.')) localStorage.removeItem(key);
      }
    }, FEATURE_FLAG_DEFAULTS);

    await context.route('**/*interpreter*', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          elements: [
            {
              type: 'node',
              id: 4242,
              lat: 37.7665,
              lon: -120.8471,
              tags: { shop: 'supermarket', name: 'E2E Test Mart' },
            },
            {
              type: 'node',
              id: 4243,
              lat: 37.7672,
              lon: -120.8462,
              tags: {
                shop: 'department_store',
                name: 'Walmart Supercenter',
                brand: 'Walmart',
                'brand:wikidata': 'Q483551',
              },
            },
          ],
        }),
      });
    });

    await context.route(`**${basePath}/pwa-register.js`, (route) => route.abort());

    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('pageerror:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('console:', msg.text());
    });
    await runGuestFlow(page);
    await context.close();

    console.log('Web core flow E2E passed (guest).');
  } finally {
    await browser.close();
    server.close();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
