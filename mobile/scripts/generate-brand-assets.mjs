#!/usr/bin/env node
/**
 * Generates Expo / Android / in-app brand assets from assets/mealplanatic-logo-source.png.
 * Crop bounds and colors are defined in config/appBrand.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const brandPath = path.join(mobileRoot, 'config', 'appBrand.json');
const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));

const sourcePath = path.join(mobileRoot, brand.sourceLogo);
if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing source logo: ${sourcePath}`);
}

const creamHex = brand.colors.brandCream;
const creamRgb = hexToRgb(creamHex);

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function assetOut(relative) {
  return path.join(mobileRoot, relative);
}

function extractCrop(crop) {
  return sharp(sourcePath).extract({
    left: crop.left,
    top: crop.top,
    width: crop.width,
    height: crop.height,
  });
}

/** Fit artwork inside a square canvas on brand cream. */
async function squareOnCream(pipeline, size, contentScale = 0.88) {
  const inner = Math.round(size * contentScale);
  const resized = await pipeline
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { ...creamRgb, alpha: 1 },
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/** Android adaptive foreground: icon within ~66% safe zone on transparent (for compositing). */
async function androidForeground(iconSquareBuffer, size = 1024) {
  const safe = Math.round(size * 0.66);
  const inset = Math.round((size - safe) / 2);
  const inner = await sharp(iconSquareBuffer)
    .resize(safe, safe, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: inner, left: inset, top: inset }])
    .png()
    .toBuffer();
}

async function solidBackground(size, color) {
  const rgb = hexToRgb(color);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: rgb,
    },
  })
    .png()
    .toBuffer();
}

async function monochromeFrom(buffer, size) {
  return sharp(buffer)
    .resize(size, size, { fit: 'contain', background: creamRgb })
    .greyscale()
    .threshold(200)
    .png()
    .toBuffer();
}

async function transparentFull(crop) {
  const { data, info } = await extractCrop(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tolerance = 14;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const nearCream =
      Math.abs(r - creamRgb.r) <= tolerance &&
      Math.abs(g - creamRgb.g) <= tolerance &&
      Math.abs(b - creamRgb.b) <= tolerance;
    if (nearCream) {
      data[i + 3] = 0;
    } else {
      data[i + 3] = 255;
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function main() {
  const iconCrop = await extractCrop(brand.crops.icon);
  const fullCrop = await extractCrop(brand.crops.full);

  const icon1024 = await squareOnCream(iconCrop.clone(), 1024, 0.86);
  const splash512 = await squareOnCream(iconCrop.clone(), 512, 0.8);
  const markHeader = await squareOnCream(iconCrop.clone(), 66, 0.9);

  const androidFg = await androidForeground(icon1024);
  const androidBg = await solidBackground(1024, creamHex);
  const androidMono = await monochromeFrom(icon1024, 1024);

  const favicon = await sharp(icon1024).resize(48, 48).png().toBuffer();

  const logoFull = await fullCrop.png().toBuffer();
  const logoTransparent = await transparentFull(brand.crops.full);

  const writes = [
    [brand.assets.icon, icon1024],
    [brand.assets.splashIcon, splash512],
    [brand.assets.favicon, favicon],
    [brand.assets.androidIconForeground, androidFg],
    [brand.assets.androidIconBackground, androidBg],
    [brand.assets.androidIconMonochrome, androidMono],
    [brand.assets.logoFull, logoFull],
    [brand.assets.logoFullTransparent, logoTransparent],
    [brand.assets.logoMark, markHeader],
  ];

  for (const [relative, buffer] of writes) {
    const out = assetOut(relative);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(buffer).toFile(out);
    console.log('wrote', relative);
  }

  console.log('Brand assets generated from', brand.sourceLogo);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
