#!/usr/bin/env node
/**
 * Post-process Expo web export: precache list, service worker version, nested route indexes.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const distDir = path.join(mobileRoot, 'dist');
const appJson = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8'));

const baseUrl = appJson.expo?.experiments?.baseUrl ?? '';
const basePath = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

const ROUTE_NAMES = ['profile', 'admin', 'pantry', 'grocery', 'recipes', 'smart-shop'];

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function toPublicUrl(distRelative) {
  const posix = distRelative.split(path.sep).join('/');
  return `${basePath}/${posix}`;
}

function collectPrecacheUrls() {
  const urls = new Set();

  for (const file of walkFiles(distDir)) {
    const rel = path.relative(distDir, file);
    if (rel.startsWith('..')) continue;
    const posix = rel.split(path.sep).join('/');
    if (posix.endsWith('.html') && !posix.includes('(tabs)')) {
      urls.add(toPublicUrl(posix));
    }
    if (posix.startsWith('_expo/static/')) {
      urls.add(toPublicUrl(posix));
    }
    if (posix.startsWith('icons/')) {
      urls.add(toPublicUrl(posix));
    }
    if (posix === 'manifest.webmanifest' || posix === 'favicon.ico') {
      urls.add(toPublicUrl(posix));
    }
  }

  urls.add(toPublicUrl('index.html'));
  for (const route of ROUTE_NAMES) {
    urls.add(toPublicUrl(`${route}/index.html`));
    urls.add(toPublicUrl(`${route}.html`));
  }

  return [...urls].sort();
}

function cacheVersion(precacheUrls) {
  return crypto.createHash('sha256').update(precacheUrls.join('\n')).digest('hex').slice(0, 12);
}

function patchServiceWorker(version, precacheUrls) {
  const swPath = path.join(distDir, 'sw.js');
  if (!fs.existsSync(swPath)) {
    throw new Error(`Missing ${swPath} — ensure public/sw.js exists before export`);
  }
  let source = fs.readFileSync(swPath, 'utf8');
  source = source.replaceAll('__CACHE_VERSION__', version);
  source = source.replaceAll('__PRECACHE_URLS__', JSON.stringify(precacheUrls, null, 2));
  if (source.includes('__PRECACHE_URLS__') || source.includes('__CACHE_VERSION__')) {
    throw new Error('Service worker still contains unfilled PWA placeholders after patch');
  }
  fs.writeFileSync(swPath, source);
}

function patchPwaRegister() {
  const registerPath = path.join(distDir, 'pwa-register.js');
  if (!fs.existsSync(registerPath)) return;
  const scopeBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const swAbsolute = `${basePath}/sw.js`;
  let source = fs.readFileSync(registerPath, 'utf8');
  source = source.replaceAll('__PWA_BASE_PATH__', basePath);
  source = source.replaceAll('__PWA_SW_URL__', swAbsolute);
  source = source.replaceAll('__PWA_SW_SCOPE__', scopeBase);
  fs.writeFileSync(registerPath, source);
}

function ensureNestedRouteIndexes() {
  for (const route of ROUTE_NAMES) {
    const htmlFile = path.join(distDir, `${route}.html`);
    const routeDir = path.join(distDir, route);
    const indexFile = path.join(routeDir, 'index.html');
    if (!fs.existsSync(htmlFile)) continue;
    fs.mkdirSync(routeDir, { recursive: true });
    fs.copyFileSync(htmlFile, indexFile);
  }
}

/** GitHub Pages serves 404.html for unknown paths — SPA shell for deep links (e.g. discover-recipes/10879). */
function ensureSpa404Fallback() {
  const indexFile = path.join(distDir, 'index.html');
  const fallbackFile = path.join(distDir, '404.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error('dist/index.html missing — cannot create SPA 404 fallback');
  }
  fs.copyFileSync(indexFile, fallbackFile);
}

function assertArtifacts() {
  const required = [
    '404.html',
    'manifest.webmanifest',
    'sw.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png',
    'icons/icon-maskable-192.png',
    'icons/icon-maskable-512.png',
  ];
  for (const rel of required) {
    const full = path.join(distDir, rel);
    if (!fs.existsSync(full)) {
      throw new Error(`Export missing PWA artifact: ${rel}`);
    }
  }
}

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ not found — run expo export -p web first');
  }
  ensureNestedRouteIndexes();
  ensureSpa404Fallback();
  const precacheUrls = collectPrecacheUrls();
  const version = cacheVersion(precacheUrls);
  patchServiceWorker(version, precacheUrls);
  patchPwaRegister();
  assertArtifacts();
  console.log(`PWA export ready (cache ${version}, ${precacheUrls.length} precache URLs)`);
}

main();
