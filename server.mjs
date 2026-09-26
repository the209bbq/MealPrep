#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(repoRoot, 'New');
const dailyRoot = path.join(repoRoot, 'daily-report');
const port = Number(process.env.PORT) || 4173;
const usdaKey = (process.env.USDA_FDC_API_KEY || process.env.USDA_API_KEY || '').trim();

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

async function proxyUsda(reqUrl, res) {
  const incoming = new URL(reqUrl, 'http://localhost');
  const key = usdaKey || incoming.searchParams.get('api_key') || 'DEMO_KEY';
  let target;
  if (incoming.pathname === '/api/usda/search') {
    const params = new URLSearchParams({
      query: incoming.searchParams.get('query') || '',
      pageSize: incoming.searchParams.get('pageSize') || '8',
      dataType: 'Foundation,SR Legacy,Survey (FNDDS)',
      api_key: key
    });
    target = `https://api.nal.usda.gov/fdc/v1/foods/search?${params}`;
  } else if (incoming.pathname.startsWith('/api/usda/food/')) {
    const id = incoming.pathname.replace('/api/usda/food/', '');
    target = `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(id)}?api_key=${encodeURIComponent(key)}`;
  } else {
    send(res, 404, JSON.stringify({ error: 'Unknown USDA route' }), { 'Content-Type': 'application/json' });
    return;
  }

  const response = await fetch(target, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  send(res, response.status, text, { 'Content-Type': 'application/json' });
}

function serveFrom(base, relPath, res) {
  const filePath = path.join(base, relPath);
  if (!filePath.startsWith(base)) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
      return;
    }
    send(res, 200, data, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
  });
}

function serveFile(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/daily-report' || url.pathname === '/daily-report/') {
    serveFrom(dailyRoot, '/index.html', res);
    return;
  }
  if (url.pathname.startsWith('/daily-report/')) {
    serveFrom(dailyRoot, url.pathname.slice('/daily-report'.length), res);
    return;
  }
  serveFrom(root, url.pathname === '/' ? '/index.html' : url.pathname, res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/usda/')) {
      await proxyUsda(req.url, res);
      return;
    }
    serveFile(req, res);
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }), { 'Content-Type': 'application/json' });
  }
});

server.listen(port, () => {
  console.log(`209 Meal Prep at http://localhost:${port}/`);
  console.log(`Daily report at http://localhost:${port}/daily-report/`);
  if (!usdaKey) {
    console.log('USDA_FDC_API_KEY is unset; USDA proxy will use DEMO_KEY.');
  }
});
