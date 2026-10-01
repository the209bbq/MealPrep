/**
 * Playwright: web file picker waits for late `input.files` population (mobile Safari).
 * Run from mobile/: npm run test:prepare-image-web
 */
import { chromium } from 'playwright';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function testLateFilePopulation(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
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
        dt.items.add(new File([new Uint8Array([1, 2, 3])], 'late-phone.jpg', { type: 'image/jpeg' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, 600);
    })
  `);

  await browser.close();
  assert(outcome === 'late-phone.jpg', `expected late file, got ${outcome}`);
}

async function main(): Promise<void> {
  await testLateFilePopulation();
  console.log('prepare-image-web-check: OK');
}

void main();
