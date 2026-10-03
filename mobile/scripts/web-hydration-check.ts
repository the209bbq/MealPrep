/**
 * Playwright hydration check for static web export (GitHub Pages subpath).
 * Run from mobile/ after export:web:
 *   npx serve dist -l 8765 --no-port-switching
 *   APP_BASE=/MealPrep/app npx tsx scripts/web-hydration-check.ts
 */
import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distDir = path.join(mobileRoot, 'dist');
const serveRoot = path.join(mobileRoot, '.hydration-serve-root');

const basePath = (process.env.APP_BASE ?? '/MealPrep/app').replace(/\/$/, '');
const port = Number(process.env.PORT ?? 8765);
const origin = `http://127.0.0.1:${port}`;

const ROUTES = (process.env.HYDRATION_ROUTES ?? '/,/pantry,/recipes,/grocery,/profile,/smart-shop,/delete-account')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
/** /profile redirects to home (legacy email links). */

function hydrationErrorsFromText(text: string): string[] {
  return text
    .split('\n')
    .filter(
      (line) =>
        /Minified React error #418/.test(line) ||
        /Minified React error #419/.test(line) ||
        /Hydration failed/i.test(line) ||
        /did not match/i.test(line),
    );
}

async function visitRoutes(page: Page, prefix: string): Promise<string[]> {
  const lines: string[] = [];
  page.on('console', (msg) => {
    lines.push(msg.text());
  });
  page.on('pageerror', (err) => {
    lines.push(String(err));
  });
  for (const route of ROUTES) {
    const url = `${origin}${prefix}${route === '/' ? '/' : route}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(500);
  }
  return lines;
}

function prepareServeRoot(): string {
  const nested = path.join(serveRoot, basePath.replace(/^\//, ''));
  fs.rmSync(serveRoot, { recursive: true, force: true });
  fs.mkdirSync(nested, { recursive: true });
  for (const entry of fs.readdirSync(distDir)) {
    const from = path.join(distDir, entry);
    const to = path.join(nested, entry);
    fs.cpSync(from, to, { recursive: true });
  }
  return serveRoot;
}

function waitForHttpReady(): Promise<void> {
  const deadline = Date.now() + 20_000;
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

function startServer(): Promise<{ proc: ReturnType<typeof spawn>; close: () => void }> {
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
          proc,
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

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const cleanContext = await browser.newContext();
    const cleanPage = await cleanContext.newPage();
    await cleanPage.route(`**${basePath}/pwa-register.js`, (route) => route.abort());
    const cleanLines = await visitRoutes(cleanPage, basePath);
    const cleanErrors = hydrationErrorsFromText(cleanLines.join('\n'));
    await cleanContext.close();

    const staleContext = await browser.newContext();
    const stalePage = await staleContext.newPage();
    await stalePage.route(`**${basePath}/pwa-register.js`, (route) => route.abort());
    await stalePage.goto(`${origin}${basePath}/`, { waitUntil: 'networkidle' });
    await stalePage.evaluate(async (scope) => {
      if (!('serviceWorker' in navigator)) return;
      await navigator.serviceWorker.register(`${scope}/sw.js`, { scope: `${scope}/` });
      await navigator.serviceWorker.ready;
    }, basePath);
    const staleLines = await visitRoutes(stalePage, basePath);
    const staleErrors = hydrationErrorsFromText(staleLines.join('\n'));
    await stalePage
      .evaluate(async () => {
        if (!('serviceWorker' in navigator)) return;
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      })
      .catch(() => undefined);
    await staleContext.close();

    if (cleanErrors.length > 0) {
      console.error('Hydration errors (clean profile):\n', cleanErrors.join('\n'));
      process.exitCode = 1;
    }
    if (staleErrors.length > 0) {
      console.error('Hydration errors (with service worker):\n', staleErrors.join('\n'));
      process.exitCode = 1;
    }
    if (process.exitCode !== 1) {
      console.log(`Web hydration check passed (${ROUTES.length} routes × 2 profiles).`);
    }
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
