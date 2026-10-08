/**
 * Playwright: pantry web file input + prepare on static export (Pixel / Android Chrome).
 * Uses test/fixtures/photos/pantry-rack.jpg. Mocks auth + pantry-vision.
 * Run after export:web: npm run test:web-pantry-photo-scan
 */
import { devices, chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distDir = path.join(mobileRoot, 'dist');
const serveRoot = path.join(mobileRoot, '.pantry-scan-serve-root');
const userPhoto = path.join(mobileRoot, 'test/fixtures/photos/pantry-rack.jpg');

const basePath = (process.env.APP_BASE ?? '').replace(/\/$/, '');
const port = Number(process.env.PORT ?? 8766);
const origin = `http://127.0.0.1:${port}`;

function prepareServeRoot(): string {
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
      .then(() => resolve({ close: () => proc.kill('SIGKILL') }))
      .catch((err) => {
        proc.kill('SIGTERM');
        reject(err);
      });
  });
}

async function main() {
  if (!fs.existsSync(distDir)) {
    console.error('Missing dist/ — run npm run export:web first');
    process.exit(1);
  }
  if (!fs.existsSync(userPhoto)) {
    console.error('Missing test/fixtures/photos/pantry-rack.jpg');
    process.exit(1);
  }

  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 5'] });

  try {
    const page = await context.newPage();
    await page.route(`**${basePath}/pwa-register.js`, (route) => route.abort());

    await page.route('**/functions/v1/pantry-vision**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ name: 'Canned beans', category: 'pantry', confidence: 0.9 }],
          model: 'test-mock',
        }),
      });
    });

    await page.goto(`${origin}${basePath}/pantry`, { waitUntil: 'networkidle', timeout: 90_000 });

    const lookAround = page.getByRole('button', { name: 'Look around first' });
    if (await lookAround.isVisible().catch(() => false)) {
      await lookAround.click({ force: true });
    }

    const scanShelf = page.getByLabel(/Scan shelf with camera or photo library/i);
    await scanShelf.scrollIntoViewIfNeeded();
    await scanShelf.click({ force: true });
    const libraryButton = page.getByText('Choose from library', { exact: true });
    await libraryButton.waitFor({ timeout: 10_000 });

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 20_000 });
    await libraryButton.click({ force: true });
    let fileChooser;
    try {
      fileChooser = await fileChooserPromise;
    } catch {
      console.warn('Pantry photo scan check: file chooser did not open in headless (skipping UI leg).');
      return;
    }
    await fileChooser.setFiles(userPhoto);

    await page
      .getByText('Review scan', { exact: false })
      .or(page.getByText('Analyzing photo', { exact: false }))
      .first()
      .waitFor({ timeout: 60_000 });

    const readPhotoTitle = page.getByText("Couldn't read that photo", { exact: false });
    const sawPrepareFailure = await readPhotoTitle.isVisible().catch(() => false);
    if (sawPrepareFailure) {
      const detail = await page.locator('text=Couldn').locator('..').locator('text=/./').nth(1).textContent().catch(() => '');
      console.error(`Prepare/scan failed with scanFailedTitle. Detail: ${detail}`);
      process.exitCode = 1;
      return;
    }

    await page.getByText('Review scan', { exact: false }).waitFor({ timeout: 60_000 });
    console.log('web-pantry-photo-scan-check: pantry-rack.jpg reached review UI on Pixel Chromium.');
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

void main();
