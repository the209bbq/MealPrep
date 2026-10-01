import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const base = process.env.APP_URL || 'http://127.0.0.1:8080';

const shots = [
  { path: '/', file: 'tab_home.png' },
  { path: '/pantry', file: 'tab_pantry.png' },
  { path: '/recipes', file: 'tab_recipes.png' },
  { path: '/grocery', file: 'tab_grocery.png' },
  { path: '/admin', file: 'tab_admin_panel.png', role: 'admin' },
  { path: '/profile', file: 'tab_profile_member.png', role: 'member' },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

for (const shot of shots) {
  if (shot.role) {
    await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle' });
    await page.evaluate((role) => {
      localStorage.setItem('mealprep.demoRole', JSON.stringify(role));
    }, shot.role);
    await page.reload({ waitUntil: 'networkidle' });
  } else {
    await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, shot.file), fullPage: true });
}

await browser.close();
console.log('Saved screenshots to', outDir);
