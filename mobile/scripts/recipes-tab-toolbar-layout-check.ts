/**
 * Sanity check that the Recipes tab toolbar fits on common phone widths.
 * Optional Playwright pass (requires dist/): RECIPES_TOOLBAR_E2E=1 npm run test:recipes-tab-toolbar-layout
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CREATOR_RECIPES_FEED_MODE_SHORT_LABELS,
  CREATOR_RECIPES_FEED_MODES,
} from '../config/creatorRecipes';

const DROPDOWN_TRIGGER_MAX_PX = 108;
const TOOLBAR_GAP_PX = 6;
const SCROLL_AND_CARD_HORIZONTAL_PADDING_PX = 16 * 4;

for (const mode of CREATOR_RECIPES_FEED_MODES) {
  const short = CREATOR_RECIPES_FEED_MODE_SHORT_LABELS[mode];
  assert.ok(short.length > 0 && short.length <= 10, `short label for ${mode}`);
}

for (const viewportWidth of [360, 412]) {
  const toolbarInnerWidth = viewportWidth - SCROLL_AND_CARD_HORIZONTAL_PADDING_PX;
  const reserved = DROPDOWN_TRIGGER_MAX_PX + TOOLBAR_GAP_PX;
  const searchWidth = toolbarInnerWidth - reserved;
  assert.ok(
    searchWidth >= 72,
    `expected search field width >= 72px at ${viewportWidth}px viewport (got ${searchWidth})`,
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distDir = path.join(mobileRoot, 'dist');
const serveRoot = path.join(mobileRoot, '.toolbar-layout-serve-root');

function prepareServeRoot(): string {
  const basePath = (process.env.APP_BASE ?? '/MealPrep/app').replace(/\/$/, '');
  const nested = path.join(serveRoot, basePath.replace(/^\//, ''));
  fs.rmSync(serveRoot, { recursive: true, force: true });
  fs.mkdirSync(nested, { recursive: true });
  for (const entry of fs.readdirSync(distDir)) {
    fs.cpSync(path.join(distDir, entry), path.join(nested, entry), { recursive: true });
  }
  return serveRoot;
}

async function runPlaywrightLayoutCheck(): Promise<void> {
  if (!fs.existsSync(distDir)) {
    console.log('recipes-tab-toolbar-layout-check: skip e2e (no dist/)');
    return;
  }

  const { chromium } = await import('playwright');
  const { spawn } = await import('node:child_process');

  const port = Number(process.env.PORT ?? 8767);
  const origin = `http://127.0.0.1:${port}`;
  const basePath = (process.env.APP_BASE ?? '/MealPrep/app').replace(/\/$/, '');
  const root = prepareServeRoot();

  const server = spawn('npx', ['serve', root, '-l', String(port), '--no-port-switching'], {
    cwd: mobileRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const probe = `${origin}${basePath}/`;
  await new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 30_000;
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

  const browser = await chromium.launch();
  try {

    for (const width of [360, 412]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      await page.goto(`${origin}${basePath}/`, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(800);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 1;
      });
      assert.equal(overflow, false, `horizontal overflow at ${width}px`);

      const feedButton = page.getByRole('button', { name: /recipe feed/i }).first();
      const box = await feedButton.boundingBox();
      assert.ok(box, `feed dropdown visible at ${width}px`);
      assert.ok(
        box.x + box.width <= width + 0.5,
        `feed dropdown should fit in viewport at ${width}px (right=${box.x + box.width})`,
      );

      await feedButton.click({ force: true });
      await page.waitForTimeout(200);
      const newItem = page.getByText('New', { exact: true }).first();
      await newItem.waitFor({ state: 'visible', timeout: 5000 });
      const menuItem = page.getByText('Quick', { exact: true }).first();
      const menuBox = await menuItem.boundingBox();
      assert.ok(menuBox, 'feed menu should open');
      assert.ok(
        menuBox.x >= -1 && menuBox.x + menuBox.width <= width + 1,
        `feed menu should stay on-screen at ${width}px`,
      );
      const budgetVisible = await newItem.isVisible();
      assert.equal(budgetVisible, true, `New option should not be hidden behind import UI at ${width}px`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill('SIGKILL');
  }
}

async function main(): Promise<void> {
  if (process.env.RECIPES_TOOLBAR_E2E === '1') {
    await runPlaywrightLayoutCheck();
  }
  console.log('recipes-tab-toolbar-layout-check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
