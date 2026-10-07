/**
 * Asserts web export chunks do not embed the ZCTA table or heic2any outside Stores,
 * and tests avatar URL sizing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sizedCreatorAvatarUrl } from '../lib/images/sizedCreatorAvatarUrl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distJsDir = path.join(mobileRoot, 'dist', '_expo', 'static', 'js', 'web');

const CORE_CHUNK_PREFIXES = ['__common-', 'entry-'] as const;

/** Home / Pantry / Grocery route chunks must not ship ZCTA data (Stores tab only). */
const TAB_ROUTE_CHUNK_MATCHERS: Array<{ label: string; match: (name: string) => boolean }> = [
  { label: 'Home (index)', match: (name) => name.startsWith('index-') },
  { label: 'Pantry', match: (name) => name.startsWith('pantry-') && !name.startsWith('pantry-staples') },
  { label: 'Grocery', match: (name) => name.startsWith('grocery-') },
];

function assertAvatarSizing(): void {
  const yt = 'https://yt3.ggpht.com/ytc/AIdro_kabc=s800-c-k-c0x00ffffff-no-rj';
  const sized = sizedCreatorAvatarUrl(yt, 56);
  assert(sized?.includes('=s112'), `expected 2×56 -> s112, got ${sized}`);
  assert(!sized?.includes('=s800'), 'must downsize s800');
  assert.equal(
    sized,
    'https://yt3.ggpht.com/ytc/AIdro_kabc=s112-c-k-c0x00ffffff-no-rj',
    'must preserve ggpht size suffix after hex color token',
  );

  const yt88 = 'https://yt3.ggpht.com/ytc/APYwI0Y5abc=s88-c-k-c0x00ffffff-no-rj';
  const sized88 = sizedCreatorAvatarUrl(yt88, 40);
  assert.equal(
    sized88,
    'https://yt3.ggpht.com/ytc/APYwI0Y5abc=s80-c-k-c0x00ffffff-no-rj',
    'realistic yt3 path with =s88…-c0x00ffffff-no-rj suffix',
  );

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

function findChunkSource(matchFn: (name: string) => boolean): { name: string; source: string } | null {
  if (!fs.existsSync(distJsDir)) return null;
  const name = fs.readdirSync(distJsDir).find((f) => f.endsWith('.js') && matchFn(f));
  if (!name) return null;
  return { name, source: fs.readFileSync(path.join(distJsDir, name), 'utf8') };
}

function countZctaEntries(source: string): number {
  const matches = source.match(/"\d{5}":\[/g);
  return matches?.length ?? 0;
}

function assertChunkFreeOfZctaAndHeic(label: string, source: string): void {
  const zctaEntries = countZctaEntries(source);
  assert(zctaEntries < 5, `${label} must not embed ZCTA JSON (found ${zctaEntries} zip entries)`);
  assert(!source.includes('libheif'), `${label} must not embed heic2any (libheif marker)`);
}

function assertBundleChunks(): void {
  if (!fs.existsSync(distJsDir)) {
    console.log('bundle-size-check: SKIP — dist/_expo/static/js/web missing (run expo export --platform web first)');
    return;
  }

  for (const prefix of CORE_CHUNK_PREFIXES) {
    const source = readChunk(prefix);
    assert(source, `missing ${prefix} chunk in dist export`);
    assertChunkFreeOfZctaAndHeic(prefix, source);
  }

  for (const { label, match } of TAB_ROUTE_CHUNK_MATCHERS) {
    const chunk = findChunkSource(match);
    assert(chunk, `missing ${label} route chunk in dist export`);
    assertChunkFreeOfZctaAndHeic(`${label} (${chunk.name})`, chunk.source);
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
