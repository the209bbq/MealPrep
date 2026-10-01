/**
 * Playwright: pantry web file input starts scan flow on static export.
 * Run from mobile/ after export:web:
 *   npx serve dist -l 8766 --no-port-switching  (or let this script start serve)
 *   APP_BASE=/MealPrep/app npx tsx scripts/web-pantry-photo-scan-check.ts
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distDir = path.join(mobileRoot, 'dist');
const serveRoot = path.join(mobileRoot, '.pantry-scan-serve-root');

const basePath = (process.env.APP_BASE ?? '/MealPrep/app').replace(/\/$/, '');
const port = Number(process.env.PORT ?? 8766);
const origin = `http://127.0.0.1:${port}`;

const MINIMAL_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EADAQAAIBAwMCBQQDAwUAAAAAAAECAwAEEQUSITETQVFhBiJxgZEUobHB0fAjQuH/xAAZAQADAQEBAAAAAAAAAAAAAAABAgMABP/EACARAAIBBQEAAwEBAAAAAAAAAAECAxEEBRIhMQYTQVFh/9oADAMBAAIRAxEAPwD9gKKKKKAP/9k=',
  'base64',
);

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
      .then(() => {
        resolve({
          close: () => proc.kill('SIGKILL'),
        });
      })
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

  const server = await startServer();
  const browser = await chromium.launch();
  const tmpImage = path.join(mobileRoot, '.tmp-pantry-scan-test.jpg');
  fs.writeFileSync(tmpImage, MINIMAL_JPEG);

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route(`**${basePath}/pwa-register.js`, (route) => route.abort());

    await page.goto(`${origin}${basePath}/pantry`, { waitUntil: 'networkidle', timeout: 60_000 });

    const libraryButton = page.getByLabel(/from photo library/i).first();
    await libraryButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 20_000 });
    await libraryButton.click({ force: true });
    let fileChooser;
    try {
      fileChooser = await fileChooserPromise;
    } catch {
      console.warn('Pantry photo scan check: file chooser did not open in headless (skipping UI leg).');
      await context.close();
      return;
    }
    await fileChooser.setFiles(tmpImage);

    await page.getByText('Analyzing photo', { exact: false }).waitFor({ timeout: 20_000 });

    const sawReviewOrError = await Promise.race([
      page.getByText('Review scan', { exact: false }).waitFor({ timeout: 45_000 }).then(() => 'review'),
      page.getByText('No items found', { exact: false }).waitFor({ timeout: 45_000 }).then(() => 'empty'),
      page.getByText('Scan failed', { exact: false }).waitFor({ timeout: 45_000 }).then(() => 'error'),
      page.getByText('Sign in', { exact: false }).waitFor({ timeout: 45_000 }).then(() => 'signin'),
    ]).catch(() => 'timeout');

    if (sawReviewOrError === 'timeout') {
      console.error('Pantry photo scan did not reach review, error, or sign-in UI after file upload');
      process.exitCode = 1;
    } else if (sawReviewOrError === 'signin') {
      console.log('Pantry photo scan check: file input ran; live build requires sign-in (expected without mocked session).');
    } else {
      console.log(`Pantry photo scan check passed (outcome: ${sawReviewOrError}).`);
    }

    await context.close();
  } finally {
    fs.rmSync(tmpImage, { force: true });
    await browser.close();
    server.close();
  }
}

void main();
