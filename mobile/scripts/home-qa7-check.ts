/**
 * Home QA round 7 (R7-1, R7-2): neutral SSR account chrome, guest Sign-in after authReady, savory dumplings plural.
 * Run from mobile/: npm run test:home-qa7
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_HEADER_COPY } from '../config/appRoutes';
import { resolveAccountHeaderAccessibilityLabel } from '../lib/account/accountHeaderChrome';
import { mealDbMealToAppRecipe } from '../lib/mealdb/normalize';
import { recipeSuitsMealPickerSlot } from '../lib/mealCalendar/mealPickerSlotFilter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

const signInLabel = ACCOUNT_HEADER_COPY.avatarAccessibilityLabelGuest;
const neutralLabel = ACCOUNT_HEADER_COPY.avatarAccessibilityLabelNeutral;
const signedInLabel = ACCOUNT_HEADER_COPY.avatarAccessibilityLabelSignedIn;

function assertAppHeaderNeutralAuthLabelSource(): void {
  const headerSource = fs.readFileSync(path.join(mobileRoot, 'components/AppHeader.tsx'), 'utf8');
  assert.match(headerSource, /resolveAccountHeaderAccessibilityLabel/);
  assert.match(headerSource, /accountChromeReady/);
  assert.match(headerSource, /hasLikelyStoredAuthSession/);
}

function assertAccountHeaderLabelStates(): void {
  assert.equal(
    resolveAccountHeaderAccessibilityLabel({
      demoMode: false,
      hydrated: false,
      authReady: false,
      signedIn: false,
    }),
    neutralLabel,
    'SSR / pre-hydration must use neutral Account label',
  );
  assert.equal(
    resolveAccountHeaderAccessibilityLabel({
      demoMode: false,
      hydrated: true,
      authReady: false,
      signedIn: true,
    }),
    signedInLabel,
    'stored-session hint before authReady should not flash Sign-in',
  );
  assert.equal(
    resolveAccountHeaderAccessibilityLabel({
      demoMode: false,
      hydrated: true,
      authReady: true,
      signedIn: false,
    }),
    signInLabel,
    'signed-out guest after authReady must get Sign-in label',
  );
}

function assertSavoryDumplingsPluralAllowList(): void {
  const festival = mealDbMealToAppRecipe({
    idMeal: '52897',
    strMeal: 'Jamaican Festival (Sweet Dumpling)',
    strCategory: 'Side',
    strMealThumb: 'https://example.com/thumb.jpg',
    strInstructions: 'Cook.',
    strIngredient1: 'flour',
    strMeasure1: '1 cup',
  });
  assert.ok(!recipeSuitsMealPickerSlot(festival, 'dinner'), 'sweet festival must stay out of dinner');

  const savoryPlural = mealDbMealToAppRecipe({
    idMeal: '52999',
    strMeal: 'Jamaican Fried/Boiled Dumplings',
    strCategory: 'Side',
    strMealThumb: 'https://example.com/thumb.jpg',
    strInstructions: 'Cook.',
    strIngredient1: 'flour',
    strMeasure1: '1 cup',
  });
  assert.ok(
    recipeSuitsMealPickerSlot(savoryPlural, 'dinner'),
    'savory dumplings (plural) should pass dinner side allow-list',
  );
}

const exportEnv = {
  ...process.env,
  EXPO_PUBLIC_SUPABASE_URL:
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://okkwapgyadpaifpmkcex.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    'sb_publishable_PCMqSfDjdX6J55lc97km1g_I7U5n-pD',
};

const qa7ExportDir = path.join(mobileRoot, '.home-qa7-dist');

async function runConfiguredExport(outputDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  const envPath = path.join(mobileRoot, '.env');
  const hadEnv = fs.existsSync(envPath);
  const priorEnv = hadEnv ? fs.readFileSync(envPath, 'utf8') : null;
  const exportLines = [
    `EXPO_PUBLIC_SUPABASE_URL=${env.EXPO_PUBLIC_SUPABASE_URL ?? ''}`,
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=${env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
  ].join('\n');
  fs.writeFileSync(envPath, `${exportLines}\n`, 'utf8');

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['expo', 'export', '--platform', 'web', '--output-dir', path.basename(outputDir)],
      {
        cwd: mobileRoot,
        stdio: 'inherit',
        env,
      },
    );
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`expo export failed with code ${code}`));
    });
  });

  if (hadEnv && priorEnv != null) {
    fs.writeFileSync(envPath, priorEnv, 'utf8');
  } else {
    fs.rmSync(envPath, { force: true });
  }
}

function htmlPathForHome(): string {
  return path.join(qa7ExportDir, 'index.html');
}

function assertExportedHomeHtmlAccountChrome(): void {
  const htmlPath = htmlPathForHome();
  assert.ok(fs.existsSync(htmlPath), 'missing dist/index.html — run export:web');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('id="root"'), 'home export must include app root');
  assert.ok(
    !html.includes(`aria-label="${signInLabel}"`),
    'pre-rendered Home HTML must not expose guest Sign-in aria-label',
  );
  assert.ok(
    html.includes(`aria-label="${neutralLabel}"`),
    'pre-rendered Home HTML must use neutral Account aria-label',
  );
}

async function main(): Promise<void> {
  assertAppHeaderNeutralAuthLabelSource();
  assertAccountHeaderLabelStates();
  assertSavoryDumplingsPluralAllowList();

  const skipExport =
    process.env.HOME_QA7_SKIP_EXPORT === '1' && fs.existsSync(htmlPathForHome());
  if (!skipExport) {
    fs.rmSync(qa7ExportDir, { recursive: true, force: true });
    fs.mkdirSync(qa7ExportDir, { recursive: true });
    await runConfiguredExport(qa7ExportDir, exportEnv);
  }

  assertExportedHomeHtmlAccountChrome();

  console.log('home-qa7-check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
