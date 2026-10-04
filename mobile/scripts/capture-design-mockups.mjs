import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const outDir = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';
const viewport = { width: 412, height: 915 };
const port = Number(process.env.EXPO_WEB_PORT || 8081);
const base = process.env.APP_URL || `http://127.0.0.1:${port}`;

const SAMPLE_GROCERY = [
  {
    id: 'mock-grocery-1',
    ingredientId: 'soy-sauce',
    name: 'Soy sauce',
    quantity: 1,
    unit: 'bottle',
    category: 'condiments',
    checked: false,
    sourceRecipeIds: ['mock-recipe-1'],
  },
  {
    id: 'mock-grocery-2',
    ingredientId: 'broccoli',
    name: 'Broccoli florets',
    quantity: 2,
    unit: 'cups',
    category: 'produce',
    checked: false,
    sourceRecipeIds: ['mock-recipe-1'],
  },
  {
    id: 'mock-grocery-3',
    ingredientId: 'rice',
    name: 'Jasmine rice',
    quantity: 1,
    unit: 'bag',
    category: 'dry_goods',
    checked: true,
    sourceRecipeIds: [],
  },
];

async function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not ready at ${url}`);
}

const mobileDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

function startExpoWeb() {
  const child = spawn('npx', ['expo', 'start', '--web', '--port', String(port)], {
    cwd: mobileDir,
    env: { ...process.env, CI: '1' },
    stdio: 'pipe',
  });
  return child;
}

await mkdir(outDir, { recursive: true });

const expo = startExpoWeb();
let expoKilled = false;
const killExpo = () => {
  if (!expoKilled) {
    expoKilled = true;
    expo.kill('SIGTERM');
  }
};

process.on('exit', killExpo);

try {
  await waitForServer(base);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });

  async function seedOnboarding() {
    await page.evaluate(() => {
      localStorage.setItem('mealprep.onboarding.welcomeDismissed', JSON.stringify(true));
      localStorage.setItem('mealprep.onboarding.tourCompleted', JSON.stringify(true));
    });
  }

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await seedOnboarding();

  await page.goto(`${base}/preview/video-recipe-detail?state=loaded`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(outDir, 'video-recipe-ingredients-tab.png'),
    fullPage: true,
  });

  await page.goto(`${base}/preview/video-recipe-detail?state=steps`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outDir, 'video-recipe-steps-tab.png'),
    fullPage: true,
  });

  await page.goto(`${base}/preview/video-recipe-detail?state=loading`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outDir, 'video-recipe-loading.png'),
    fullPage: true,
  });

  await page.goto(`${base}/grocery`, { waitUntil: 'networkidle' });
  await seedOnboarding();
  await page.evaluate((items) => {
    localStorage.setItem('mealprep.grocery', JSON.stringify(items));
    localStorage.setItem('mealprep.guest.grocery', JSON.stringify(items));
    localStorage.setItem('mealprep.pantry', JSON.stringify([]));
    localStorage.setItem('mealprep.guest.pantry', JSON.stringify([]));
  }, SAMPLE_GROCERY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(outDir, 'grocery-list-remove-control.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('Saved mockup screenshots to', outDir);
} finally {
  killExpo();
}
