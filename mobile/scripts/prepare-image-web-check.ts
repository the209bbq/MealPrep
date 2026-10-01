/**
 * Playwright (Chromium + Pixel): web picker timing and real preparePantryImageFromFile.
 * Uses the user's Android pantry photos under test/fixtures/photos/.
 * Run from mobile/: npm run test:prepare-image-web
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, chromium } from 'playwright';
import { PHOTO_SCAN } from '../config/appConfig';
import { inferImageMimeTypeFromHeader, isHeicMimeType, resolveImageMimeType } from '../lib/web/inferImageMimeType';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const fixturesDir = path.join(mobileRoot, 'test/fixtures/photos');
const harnessFixturesDir = path.join(__dirname, 'fixtures');
const workDir = path.join(mobileRoot, '.prepare-image-web-test');
const port = Number(process.env.PORT ?? 8771);
const origin = `http://127.0.0.1:${port}`;

const USER_PHOTOS = [
  { name: 'pantry-rack.jpg', androidName: 'content://com.android.providers.media.documents/document/image%3A100' },
  { name: 'pantry-closet.jpg', androidName: 'content://com.android.providers.media.documents/document/image%3A101' },
] as const;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function waitForHttpReady(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(url)
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

async function bundlePrepareModule(): Promise<void> {
  fs.mkdirSync(workDir, { recursive: true });
  const outfile = path.join(workDir, 'prepare-image-web-bundle.js');
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      'npx',
      [
        'esbuild',
        path.join(mobileRoot, 'lib/pantryVision/prepareImage.web.ts'),
        '--bundle',
        '--format=esm',
        '--platform=browser',
        `--inject:${path.join(harnessFixturesDir, 'esbuild-shim.js')}`,
        `--outfile=${outfile}`,
        '--log-level=error',
      ],
      { cwd: mobileRoot, stdio: 'inherit' },
    );
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`esbuild exit ${code}`))));
  });
}

function startServer(root: string): Promise<{ close: () => void }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['serve', root, '-l', String(port), '--no-port-switching'], {
      cwd: mobileRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.on('error', reject);
    void waitForHttpReady(`${origin}/prepare-image-web-harness.html`)
      .then(() => resolve({ close: () => proc.kill('SIGKILL') }))
      .catch((err) => {
        proc.kill('SIGTERM');
        reject(err);
      });
  });
}

async function analyzeUserPhotosOnDisk(): Promise<void> {
  for (const { name } of USER_PHOTOS) {
    const filePath = path.join(fixturesDir, name);
    assert(fs.existsSync(filePath), `missing fixture ${name}`);
    const bytes = fs.readFileSync(filePath);
    const header = new Uint8Array(bytes.subarray(0, 16));
    const sniffed = inferImageMimeTypeFromHeader(header);
    assert(sniffed === 'image/jpeg', `${name} must sniff as JPEG, got ${sniffed}`);
    assert(!isHeicMimeType(sniffed!), `${name} must not use HEIC path`);

    const file = new File([bytes], `content://media/external/images/media/42`, { type: '' });
    const resolved = await resolveImageMimeType(file);
    assert(resolved === 'image/jpeg', `${name} resolveImageMimeType got ${resolved}`);
    assert(bytes.length > PHOTO_SCAN.maxPayloadBytes, `${name} raw size exceeds client max (expected before resize)`);
    assert(bytes.length < 4 * 1024 * 1024, `${name} raw size should be under server MAX_IMAGE_BYTES (4MB)`);
    console.log(
      `${name}: raw=${bytes.length} bytes, sniff=${sniffed}, clientMax=${PHOTO_SCAN.maxPayloadBytes}, serverMax=4194304`,
    );
  }
}

async function testLateFilePopulation(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await context.newPage();
  await page.goto('about:blank');

  const outcome = await page.evaluate(`
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      let settled = false;
      let pollTimer;
      let focusTimer;
      const clearTimers = () => {
        if (pollTimer !== undefined) window.clearTimeout(pollTimer);
        if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      };
      const finish = (label) => {
        if (settled) return;
        settled = true;
        clearTimers();
        input.remove();
        resolve(label);
      };
      const resolveFileFromInput = () => {
        finish(input.files?.[0]?.name ?? 'none');
      };
      input.addEventListener('change', () => {
        if (input.files?.length) resolveFileFromInput();
        else window.setTimeout(resolveFileFromInput, 0);
      }, { once: true });
      const pollForSelectionAfterDismiss = (attempt = 0) => {
        if (settled) return;
        if (input.files?.length) {
          resolveFileFromInput();
          return;
        }
        if (attempt >= 16) {
          finish('cancel');
          return;
        }
        pollTimer = window.setTimeout(() => pollForSelectionAfterDismiss(attempt + 1), 250);
      };
      window.addEventListener('focus', () => {
        focusTimer = window.setTimeout(() => pollForSelectionAfterDismiss(0), 150);
      }, { once: true });
      document.body.appendChild(input);
      window.dispatchEvent(new Event('focus'));
      window.setTimeout(() => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array([1, 2, 3])], 'content://media/picker/late.jpg', { type: '' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, 600);
    })
  `);

  await context.close();
  await browser.close();
  assert(outcome === 'content://media/picker/late.jpg', `expected late Android-style file, got ${outcome}`);
}

type PrepareResult =
  | {
      ok: true;
      mimeType: string;
      byteLength: number;
      bitmapWidth: number;
      bitmapHeight: number;
    }
  | { ok: false; errorName: string; errorMessage: string };

async function testUserPhotosInBrowser(): Promise<void> {
  fs.mkdirSync(workDir, { recursive: true });
  await bundlePrepareModule();
  fs.copyFileSync(
    path.join(harnessFixturesDir, 'prepare-image-web-harness.html'),
    path.join(workDir, 'prepare-image-web-harness.html'),
  );

  const server = await startServer(workDir);
  let heicModuleRequested = false;
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await context.newPage();

  await page.route('**/*', (route) => {
    if (route.request().url().includes('heic2any')) {
      heicModuleRequested = true;
    }
    return route.continue();
  });

  try {
    await page.goto(`${origin}/prepare-image-web-harness.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof (window as { runPrepareTest?: unknown }).runPrepareTest === 'function');

    for (const { name, androidName } of USER_PHOTOS) {
      const bytes = fs.readFileSync(path.join(fixturesDir, name));
      const result = await page.evaluate(
        async ({ fileBytes, fileName }: { fileBytes: number[]; fileName: string }) => {
          const file = new File([new Uint8Array(fileBytes)], fileName, { type: '' });
          const prepared = await (
            window as {
              runPrepareTest: (f: File) => Promise<PrepareResult>;
            }
          ).runPrepareTest(file);
          return prepared;
        },
        { fileBytes: [...bytes], fileName: androidName },
      );

      if (!result.ok) {
        const blockedByQuality = result.errorName === 'PantryImageQualityError';
        assert(
          !/heic|Could not load|empty|too large|encode/i.test(result.errorMessage),
          `${name} must not fail prepare path (${result.errorName}: ${result.errorMessage})`,
        );
        console.log(
          `${name} prepare path OK (quality gate: ${blockedByQuality ? result.errorMessage : result.errorMessage})`,
        );
        continue;
      }

      assert(result.mimeType === 'image/jpeg', `${name} prepared mime`);
      assert(
        result.byteLength > 10_000 && result.byteLength <= PHOTO_SCAN.maxPayloadBytes,
        `${name} prepared byteLength ${result.byteLength} must be <= ${PHOTO_SCAN.maxPayloadBytes}`,
      );
      assert(
        result.bitmapWidth <= PHOTO_SCAN.maxImageDimension || result.bitmapHeight <= PHOTO_SCAN.maxImageDimension,
        `${name} long edge resized: ${result.bitmapWidth}x${result.bitmapHeight}`,
      );
      console.log(
        `${name} prepare OK: ${result.bitmapWidth}x${result.bitmapHeight} -> payload ${result.byteLength} bytes`,
      );
    }

    assert(!heicModuleRequested, 'heic2any must not load for user JPEG fixtures');
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

async function main(): Promise<void> {
  await analyzeUserPhotosOnDisk();
  await testLateFilePopulation();
  await testUserPhotosInBrowser();
  console.log('prepare-image-web-check: OK');
}

void main();
