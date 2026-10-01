/**
 * Regression: user Android pantry JPEGs must not be hard-blocked as blurry (#46 gate).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PHOTO_SCAN } from '../config/appConfig';
import { computeLongEdgeResize, evaluateImageQuality } from '../lib/pantryVision/prepareImageShared';

const fixturesDir = path.join(import.meta.dirname, '..', 'test/fixtures/photos');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function lumaFromFixture(name: string) {
  const buf = fs.readFileSync(path.join(fixturesDir, name));
  const meta = await sharp(buf).metadata();
  const { width: tw, height: th } = computeLongEdgeResize(meta.width!, meta.height!, PHOTO_SCAN.maxImageDimension);
  const raw = await sharp(buf).resize(tw, th).raw().toBuffer();
  const luma = new Float32Array(tw * th);
  for (let i = 0, p = 0; i < raw.length; i += 3, p += 1) {
    luma[p] = (0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2]) / 255;
  }
  return { luma, tw, th };
}

async function main(): Promise<void> {
  const solid = new Float32Array(256 * 256).fill(0.5);
  const blankEval = evaluateImageQuality(solid, 256, 256);
  assert(blankEval.hardReject === 'blank', 'uniform frame hard-rejects');

  for (const name of ['pantry-rack.jpg', 'pantry-closet.jpg']) {
    const { luma, tw, th } = await lumaFromFixture(name);
    const evaluation = evaluateImageQuality(luma, tw, th);
    console.log(name, {
      laplacianVariance: evaluation.laplacianVariance,
      luminanceStdDev: evaluation.luminanceStdDev,
      hardReject: evaluation.hardReject,
      warnings: evaluation.warnings,
    });
    assert(!evaluation.hardReject, `${name} must not hard-reject (blur is soft-only)`);
    assert(
      !evaluation.warnings.includes(PHOTO_SCAN.imageTooBlurryMessage),
      `${name} must not soft-warn blur on sharp Pixel photos`,
    );
  }

  console.log('pantry-image-quality-check: OK');
}

void main();
