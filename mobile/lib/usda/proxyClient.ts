import { USDA_PROXY } from '../../config/appConfig';
import { getSupabase } from '../supabase';
import type {
  UsdaFoodPayload,
  UsdaProxyErrorEnvelope,
  UsdaProxyFoodBody,
  UsdaProxySearchBody,
  UsdaSearchResponse,
} from './types';

interface MemoryCacheEntry {
  payload: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

function cacheGet<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return hit.payload as T;
}

function cacheSet(key: string, payload: unknown): void {
  memoryCache.set(key, { payload, expiresAt: Date.now() + USDA_PROXY.cacheTtlMs });
}

function isProxyErrorPayload(value: unknown): value is UsdaProxyErrorEnvelope {
  if (!value || typeof value !== 'object') return false;
  const row = value as UsdaProxyErrorEnvelope;
  return typeof row.code === 'string' && typeof row.error === 'string';
}

async function invokeUsdaProxy<T>(body: UsdaProxySearchBody | UsdaProxyFoodBody): Promise<T | null> {
  const supabase = getSupabase();
  if (!supabase || !USDA_PROXY.enabled) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { data, error } = await supabase.functions.invoke<T & UsdaProxyErrorEnvelope>(USDA_PROXY.functionName, {
    body,
  });

  if (error) return null;
  if (!data || isProxyErrorPayload(data)) return null;

  return data as T;
}

export async function searchUsdaFoodsViaProxy(
  query: string,
  pageSize = 8,
): Promise<UsdaFoodPayload[] | null> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `search:${q}:${pageSize}`;
  const cached = cacheGet<UsdaSearchResponse>(cacheKey);
  if (cached) return cached.foods ?? [];

  const payload = await invokeUsdaProxy<UsdaSearchResponse>({
    action: 'search',
    query: { query: q, pageSize },
  });
  if (!payload) return null;

  cacheSet(cacheKey, payload);
  return payload.foods ?? [];
}

export async function getUsdaFoodViaProxy(fdcId: number): Promise<UsdaFoodPayload | null> {
  const id = Number(fdcId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const cacheKey = `food:${id}`;
  const cached = cacheGet<UsdaFoodPayload>(cacheKey);
  if (cached) return cached;

  const payload = await invokeUsdaProxy<UsdaFoodPayload>({ action: 'food', fdcId: id });
  if (!payload) return null;

  cacheSet(cacheKey, payload);
  return payload;
}
