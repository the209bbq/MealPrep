/**
 * Playwright DOM intersection checks for Forky pill, hit box, and clouds.
 * Used by forkinator-prompts-playwright-check.ts
 */
import type { Page } from 'playwright';
import { FORKINATOR_ACCESSIBILITY_LABEL } from '../lib/forkinator/a11y';
import { FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL } from '../lib/forkinator/forkInRoadPromptCopy';
import {
  FORKINATOR_HIT_HEIGHT_PX,
  FORKINATOR_HIT_INSET_LEFT_PX,
  FORKINATOR_HIT_INSET_TOP_PX,
  FORKINATOR_HIT_WIDTH_PX,
} from '../lib/forkinator/hitArea';

export type DomRect = { left: number; top: number; width: number; height: number };

export type IntersectionHit = {
  label: string;
  role: string;
  rect: DomRect;
};

export type ForkinatorDomProbe = {
  mascotBox: DomRect | null;
  pillBox: DomRect | null;
  forkHitBox: DomRect | null;
  expandedCloudBox: DomRect | null;
};

export type IntersectionReport = {
  scenario: string;
  viewport: string;
  pillHits: IntersectionHit[];
  forkHitHits: IntersectionHit[];
  cloudPassThroughOk: boolean;
  cloudPassThroughNote: string;
};

const FORKY_LABELS = new Set([
  FORKINATOR_ACCESSIBILITY_LABEL,
  FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL,
  'Collapse meal suggestion',
  'Recipe decision helper from Forky',
  "Can't decide? Expand meal suggestion from Forky",
]);

function rectsOverlap(a: DomRect, b: DomRect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

export async function probeForkinatorDom(page: Page): Promise<ForkinatorDomProbe> {
  const args = {
    forkLabel: FORKINATOR_ACCESSIBILITY_LABEL,
    pillLabel: FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL,
    hitW: FORKINATOR_HIT_WIDTH_PX,
    hitH: FORKINATOR_HIT_HEIGHT_PX,
    hitInsetL: FORKINATOR_HIT_INSET_LEFT_PX,
    hitInsetT: FORKINATOR_HIT_INSET_TOP_PX,
  };
  const expr = `((args) => {
    const forkBtn = [...document.querySelectorAll('[role="button"]')].find(
      (el) => el.getAttribute('aria-label') === args.forkLabel,
    );
    const pillBtn = [...document.querySelectorAll('[role="button"]')].find(
      (el) => el.getAttribute('aria-label') === args.pillLabel,
    );
    const forkRect = forkBtn ? forkBtn.getBoundingClientRect() : null;
    const pillRect = pillBtn ? pillBtn.getBoundingClientRect() : null;
    let mascotBox = null;
    let forkHitBox = null;
    if (forkRect) {
      forkHitBox = { left: forkRect.left, top: forkRect.top, width: forkRect.width, height: forkRect.height };
      mascotBox = {
        left: forkRect.left - args.hitInsetL,
        top: forkRect.top - args.hitInsetT,
        width: args.hitW + args.hitInsetL,
        height: args.hitH + args.hitInsetT,
      };
    }
    const pillBox = pillRect
      ? { left: pillRect.left, top: pillRect.top, width: pillRect.width, height: pillRect.height }
      : null;
    const cloudMessage = [...document.querySelectorAll('div, span, p')].find(
      (el) =>
        el.textContent &&
        el.textContent.indexOf("Can't decide? Let's take a fork in the road.") >= 0 &&
        el.getBoundingClientRect().width > 80,
    );
    const cloudRect = cloudMessage ? cloudMessage.getBoundingClientRect() : null;
    const expandedCloudBox = cloudRect
      ? { left: cloudRect.left, top: cloudRect.top, width: cloudRect.width, height: cloudRect.height }
      : null;
    return { mascotBox, pillBox, forkHitBox, expandedCloudBox };
  })(${JSON.stringify(args)})`;
  return page.evaluate(expr);
}

export async function collectInteractiveElements(page: Page): Promise<IntersectionHit[]> {
  const labels = [...FORKY_LABELS];
  const expr = `((labels) => {
    const isForky = (el) => {
      const label = el.getAttribute('aria-label') || '';
      if (labels.indexOf(label) >= 0) return true;
      const text = (el.textContent || '').trim();
      if (text.indexOf("Can't decide? Let's take a fork in the road.") >= 0) return true;
      return false;
    };
    const nodes = new Set();
    for (const el of document.querySelectorAll(
      'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"]',
    )) {
      nodes.add(el);
    }
    const hits = [];
    for (const el of nodes) {
      if (isForky(el)) continue;
      if (el.offsetParent === null && el !== document.body) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      const label =
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        ((el.textContent || '').trim().slice(0, 60) || el.tagName);
      hits.push({
        label,
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      });
    }
    return hits;
  })(${JSON.stringify(labels)})`;
  return page.evaluate(expr);
}

export async function verifyCloudPassThrough(
  page: Page,
  cloudBox: DomRect,
  sampleTargets: IntersectionHit[],
): Promise<{ ok: boolean; note: string }> {
  if (sampleTargets.length === 0) {
    return { ok: true, note: 'no targets to sample' };
  }
  const blocked: string[] = [];
  const labels = [...FORKY_LABELS];
  for (const target of sampleTargets.slice(0, 8)) {
    const cx = target.rect.left + target.rect.width / 2;
    const cy = target.rect.top + target.rect.height / 2;
    if (rectsOverlap(cloudBox, target.rect)) continue;
    const expr = `((pt, labels) => {
      const el = document.elementFromPoint(pt.x, pt.y);
      if (!el) return '';
      const label = el.getAttribute('aria-label') || '';
      if (labels.indexOf(label) >= 0) return 'forky';
      const text = (el.textContent || '').trim();
      if (text.indexOf("Can't decide? Let's take a fork in the road.") >= 0) return 'forky';
      return label || text.slice(0, 40) || el.tagName;
    })(${JSON.stringify({ x: cx, y: cy })}, ${JSON.stringify(labels)})`;
    const top = await page.evaluate(expr);
    if (top === 'forky') blocked.push(target.label);
  }
  return {
    ok: blocked.length === 0,
    note: blocked.length ? `blocked: ${blocked.join(', ')}` : 'outside cloud taps reach controls',
  };
}

export async function runIntersectionScenario(
  page: Page,
  scenario: string,
  viewportLabel: string,
  options?: { requireExpandedCloud?: boolean },
): Promise<IntersectionReport> {
  const interactive = await collectInteractiveElements(page);
  const probe = await probeForkinatorDom(page);

  const pillHits = probe.pillBox
    ? await hitsBlockingOverlay(page, probe.pillBox, interactive)
    : [];
  const forkHitHits = probe.forkHitBox
    ? await hitsBlockingOverlay(page, probe.forkHitBox, interactive)
    : [];

  let cloudPassThroughOk = true;
  let cloudPassThroughNote = 'collapsed';
  if (options?.requireExpandedCloud && probe.expandedCloudBox) {
    const underCloud = interactive.filter(
      (el) => !rectsOverlap(probe.expandedCloudBox!, el.rect) && el.rect.top < probe.expandedCloudBox!.top,
    );
    const pass = await verifyCloudPassThrough(page, probe.expandedCloudBox, underCloud);
    cloudPassThroughOk = pass.ok;
    cloudPassThroughNote = pass.note;
  } else if (options?.requireExpandedCloud) {
    cloudPassThroughOk = false;
    cloudPassThroughNote = 'cloud not expanded';
  }

  return {
    scenario,
    viewport: viewportLabel,
    pillHits,
    forkHitHits,
    cloudPassThroughOk,
    cloudPassThroughNote,
  };
}

function pointInRect(x: number, y: number, rect: DomRect): boolean {
  return (
    x >= rect.left &&
    x <= rect.left + rect.width &&
    y >= rect.top &&
    y <= rect.top + rect.height
  );
}

export async function hitsBlockingOverlay(
  page: Page,
  overlay: DomRect,
  elements: IntersectionHit[],
): Promise<IntersectionHit[]> {
  const labels = [...FORKY_LABELS];
  const blocked: IntersectionHit[] = [];
  for (const el of elements) {
    if (!rectsOverlap(overlay, el.rect)) continue;
    const cx = el.rect.left + el.rect.width / 2;
    const cy = el.rect.top + el.rect.height / 2;
    if (!pointInRect(cx, cy, overlay)) continue;
    const sampleX = cx;
    const sampleY = cy;
    const expr = `((pt, labels) => {
      const el = document.elementFromPoint(pt.x, pt.y);
      if (!el) return false;
      let node = el;
      for (let i = 0; i < 6 && node; i++) {
        const label = node.getAttribute && node.getAttribute('aria-label');
        if (label && labels.indexOf(label) >= 0) return true;
        const text = (node.textContent || '').trim();
        if (text.indexOf("Can't decide?") >= 0 && text.indexOf('fork in the road') >= 0) return true;
        node = node.parentElement;
      }
      return false;
    })(${JSON.stringify({ x: sampleX, y: sampleY })}, ${JSON.stringify(labels)})`;
    const forkyOnTop = await page.evaluate(expr);
    if (forkyOnTop) blocked.push(el);
  }
  return blocked;
}

export function formatIntersectionTable(reports: IntersectionReport[]): string {
  const lines: string[] = [];
  lines.push('| Scenario | Viewport | Pill overlaps | Fork hit overlaps |');
  lines.push('|---|---|---|---|');
  for (const r of reports) {
    const pill =
      r.pillHits.length === 0
        ? '—'
        : r.pillHits.map((h) => h.label.replace(/\|/g, '/')).join('; ');
    const fork =
      r.forkHitHits.length === 0
        ? '—'
        : r.forkHitHits.map((h) => h.label.replace(/\|/g, '/')).join('; ');
    lines.push(`| ${r.scenario} | ${r.viewport} | ${pill} | ${fork} |`);
  }
  return lines.join('\n');
}

export function allIntersectionsClear(reports: IntersectionReport[]): boolean {
  return reports.every((r) => r.pillHits.length === 0 && r.forkHitHits.length === 0);
}
