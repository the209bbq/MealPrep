/**
 * Asserts web export chunks do not embed the ZCTA table or heic2any, and tests avatar URL sizing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sizedCreatorAvatarUrl } from '../lib/images/sizedCreatorAvatarUrl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distJsDir = path.join(mobileRoot, 'dist', '_expo', 'static', 'js', 'web');

function assertAvatarSizing(): void {
  const yt = 'https://yt3.ggpht.com/ytc/AIdro_kabc=s800-c-k-c0x00ffffff-no-rj';
  const sized = sizedCreatorAvatarUrl(yt, 56);
  assert(sized?.includes('=s112'), `expected 2×56 -> s112, got ${sized}`);
  assert(!sized?.includes('=s800'), 'must downsize s800');

  const plain = sizedCreatorAvatarUrl('https://example.com/avatar.png', 40);
  assert.equal(plain, 'https://example.com/avatar.png');

  assert.equal(sizedCreatorAvatarUrl(null, 56), null);
  assert.equal(sizedCreatorAvatarUrl('  ', 56), null);
}

function readChunk(namePrefix: string): string | null {
  if (!fs.existsSync(distJsDir)) return null;
  const match = fs
    .readdirSync(distJsDir)
    .find((f) => f.startsWith(namePrefix) && f.endsWith('.js'));
  if (!match) return null;
  return fs.readFileSync(path.join(distJsDir, match), 'utf8');
}

function countZctaEntries(source: string): number {
  const matches = source.match(/"\d{5}":\[/g);
  return matches?.length ?? 0;
}

function assertBundleChunks(): void {
  if (!fs.existsSync(distJsDir)) {
    console.log('bundle-size-check: SKIP — dist/_expo/static/js/web missing (run expo export --platform web first)');
    return;
  }

  const common = readChunk('__common-');
  const entry = readChunk('entry-');
  assert(common, 'missing __common chunk in dist export');
  assert(entry, 'missing entry chunk in dist export');

  for (const [label, source] of [
    ['__common', common!],
    ['entry', entry!],
  ] as const) {
    const zctaEntries = countZctaEntries(source);
    assert(
      zctaEntries < 5,
      `${label} must not embed ZCTA JSON (found ${zctaEntries} zip entries)`,
    );
    assert(!source.includes('libheif'), `${label} must not embed heic2any (libheif marker)`);
  }

  const logoMark = path.join(mobileRoot, 'assets', 'mealplanatic-logo-mark.png');
  if (fs.existsSync(logoMark)) {
    const bytes = fs.statSync(logoMark).size;
    assert(bytes < 80_000, `logo mark should be header-sized (<80KB), got ${bytes} B`);
  }

  console.log('bundle-size-check: chunk assertions OK');
}

function main(): void {
  assertAvatarSizing();
  console.log('bundle-size-check: avatar URL helper OK');
  assertBundleChunks();
  console.log('bundle-size-check: OK');
}

main();
