import {
  OPEN_FOOD_FACTS,
  openFoodFactsProductApiUrl,
  openFoodFactsProductPageUrl,
} from '../../config/openFoodFacts';
import { sanitizeHttpUrl } from '../recipeImport/safeHttpUrl';
import { toLookupBarcode } from './barcode';
import type { NutriScoreGrade, OpenFoodFactsLookupResult, OpenFoodFactsProduct } from './types';

export interface OpenFoodFactsLookupOptions {
  fetchImpl?: typeof fetch;
  /**
   * Sent as the User-Agent header. Pass null on web: browsers forbid setting it.
   * Defaults to the app's identifying User-Agent (native).
   */
  userAgent?: string | null;
  timeoutMs?: number;
  now?: () => number;
  /** Set false to bypass the in-memory cache. */
  useCache?: boolean;
}

type CacheEntry = { expiresAt: number; result: OpenFoodFactsLookupResult };
const cache = new Map<string, CacheEntry>();

export function clearOpenFoodFactsCache(): void {
  cache.clear();
}

function readCache(barcode: string, nowMs: number): OpenFoodFactsLookupResult | null {
  const hit = cache.get(barcode);
  if (!hit) return null;
  if (hit.expiresAt <= nowMs) {
    cache.delete(barcode);
    return null;
  }
  return hit.result;
}

function writeCache(barcode: string, result: OpenFoodFactsLookupResult, nowMs: number): void {
  if (cache.size >= OPEN_FOOD_FACTS.maxCacheEntries) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(barcode, { expiresAt: nowMs + OPEN_FOOD_FACTS.cacheTtlMs, result });
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** "en:soybeans" -> "soybeans", "en:tree-nuts" -> "tree nuts". */
function allergenTagToLabel(tag: string): string {
  const withoutLang = tag.replace(/^[a-z]{2,3}:/i, '');
  return withoutLang.replace(/-/g, ' ').trim().toLowerCase();
}

function parseNutriScore(product: Record<string, unknown>): NutriScoreGrade | null {
  const raw = asTrimmedString(product.nutriscore_grade) ?? asTrimmedString(product.nutrition_grades);
  const grade = raw?.toLowerCase();
  return grade === 'a' || grade === 'b' || grade === 'c' || grade === 'd' || grade === 'e' ? grade : null;
}

/**
 * Turns an Open Food Facts v2 response body into a product.
 * Every field is optional in their data, so this never throws on missing/odd values.
 * Returns null when there is no usable product name.
 */
export function parseOpenFoodFactsProduct(json: unknown, barcode: string): OpenFoodFactsProduct | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as Record<string, unknown>;
  if (body.status === 0) return null;
  const product = body.product;
  if (!product || typeof product !== 'object') return null;
  const p = product as Record<string, unknown>;

  const name = asTrimmedString(p.product_name) ?? asTrimmedString(p.generic_name);
  if (!name) return null;

  const allergenTags = Array.isArray(p.allergens_tags) ? p.allergens_tags : [];
  const allergens = allergenTags
    .filter((tag): tag is string => typeof tag === 'string')
    .map(allergenTagToLabel)
    .filter((label, index, all) => label.length > 0 && all.indexOf(label) === index);

  return {
    barcode,
    name,
    brand: asTrimmedString(p.brands)?.split(',')[0]?.trim() || null,
    packageSize: asTrimmedString(p.quantity),
    imageUrl: sanitizeHttpUrl(asTrimmedString(p.image_front_small_url)),
    allergens,
    nutriScore: parseNutriScore(p),
    pageUrl: openFoodFactsProductPageUrl(barcode),
  };
}

/** "Nutella" + brand "Ferrero" -> "Ferrero Nutella"; skips the brand if the name already has it. */
export function suggestedPantryName(product: Pick<OpenFoodFactsProduct, 'name' | 'brand'>): string {
  const name = product.name.trim();
  const brand = product.brand?.trim();
  if (!brand) return name;
  if (name.toLowerCase().includes(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

export async function lookupOpenFoodFactsProduct(
  rawBarcode: string,
  options: OpenFoodFactsLookupOptions = {},
): Promise<OpenFoodFactsLookupResult> {
  const barcode = toLookupBarcode(rawBarcode);
  if (!barcode) return { status: 'invalid_barcode' };

  const nowMs = (options.now ?? Date.now)();
  const useCache = options.useCache !== false;
  if (useCache) {
    const cached = readCache(barcode, nowMs);
    if (cached) return cached;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent === undefined ? OPEN_FOOD_FACTS.userAgent : options.userAgent;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (userAgent) headers['User-Agent'] = userAgent;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? OPEN_FOOD_FACTS.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(openFoodFactsProductApiUrl(barcode), { headers, signal: controller.signal });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    return {
      status: 'error',
      message: timedOut ? 'Open Food Facts timed out.' : error instanceof Error ? error.message : 'Network error.',
    };
  } finally {
    clearTimeout(timer);
  }

  // Throttled / overloaded: never cached, so a retry can succeed.
  if (response.status === 429 || response.status === 503) return { status: 'rate_limited' };

  let result: OpenFoodFactsLookupResult;
  if (response.status === 404) {
    result = { status: 'not_found' };
  } else if (!response.ok) {
    return { status: 'error', message: `Open Food Facts returned ${response.status}.` };
  } else {
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { status: 'error', message: 'Open Food Facts sent an unreadable response.' };
    }
    const product = parseOpenFoodFactsProduct(json, barcode);
    result = product ? { status: 'found', product } : { status: 'not_found' };
  }

  if (useCache) writeCache(barcode, result, nowMs);
  return result;
}
