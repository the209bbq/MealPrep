import { SMART_SHOP_STORES } from '../../config/smartShop';
import { withTimeout } from '../withTimeout';
import { isRateLimitedStatus, osmRequestHeaders } from './osmHttp';

export type OverpassMirrorAttemptResult =
  | { ok: true; elements: unknown[]; endpoint: string }
  | { ok: false; reason: 'rate_limited' | 'http' | 'network' | 'empty' | 'aborted' };

async function postOverpassQuery(
  query: string,
  endpoint: string,
  signal: AbortSignal,
): Promise<OverpassMirrorAttemptResult> {
  if (signal.aborted) return { ok: false, reason: 'aborted' };

  const perRequestMs = SMART_SHOP_STORES.overpassRequestTimeoutMs;

  try {
    const fetchPromise = fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...osmRequestHeaders(),
      },
      body: `data=${encodeURIComponent(query)}`,
      signal,
    });

    const response = await withTimeout(
      fetchPromise,
      perRequestMs,
      `Overpass request timed out (${endpoint})`,
    );

    if (isRateLimitedStatus(response.status)) return { ok: false, reason: 'rate_limited' };
    if (!response.ok) return { ok: false, reason: 'http' };

    const json = (await response.json()) as { elements?: unknown[] };
    const elements = json.elements ?? [];
    if (elements.length === 0) return { ok: false, reason: 'empty' };
    return { ok: true, elements, endpoint };
  } catch (err) {
    if (signal.aborted) return { ok: false, reason: 'aborted' };
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'network' };
  }
}

function summarizeMirrorFailures(errors: unknown[]): 'rate_limited' | 'network' | 'empty' {
  const reasons: OverpassMirrorAttemptResult[] = [];
  for (const err of errors) {
    if (typeof err === 'object' && err !== null && 'ok' in err && (err as OverpassMirrorAttemptResult).ok === false) {
      reasons.push(err as OverpassMirrorAttemptResult);
    }
  }
  if (reasons.some((r) => !r.ok && r.reason === 'rate_limited')) return 'rate_limited';
  if (reasons.length > 0 && reasons.every((r) => !r.ok && r.reason === 'empty')) return 'empty';
  return 'network';
}

/**
 * Race public Overpass mirrors; first mirror with a non-empty element list wins.
 * Losers are aborted when the overall cap elapses or a winner is found.
 */
export async function raceOverpassMirrors(
  query: string,
  endpoints: readonly string[] = SMART_SHOP_STORES.overpassApiUrls,
): Promise<{ elements: unknown[] } | { reason: 'rate_limited' | 'network' | 'empty' }> {
  const controllers = endpoints.map(() => new AbortController());
  let overallTimer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  const abortLosers = (except?: AbortController) => {
    for (const controller of controllers) {
      if (controller !== except) controller.abort();
    }
  };

  const attempts = endpoints.map((endpoint, index) =>
    postOverpassQuery(query, endpoint, controllers[index].signal).then((result) => {
      if (result.ok) {
        if (!settled) {
          settled = true;
          abortLosers(controllers[index]);
        }
        return result;
      }
      throw result;
    }),
  );

  const overallCap = new Promise<never>((_, reject) => {
    overallTimer = setTimeout(() => {
      settled = true;
      abortLosers();
      reject(new Error('overpass_overall_timeout'));
    }, SMART_SHOP_STORES.overpassOverallTimeoutMs);
  });

  try {
    const winner = await Promise.race([Promise.any(attempts), overallCap]);
    if (winner.ok) return { elements: winner.elements };
    return { reason: 'empty' };
  } catch (err) {
    if (err instanceof AggregateError) {
      return { reason: summarizeMirrorFailures(err.errors) };
    }
    if (err instanceof Error && err.message === 'overpass_overall_timeout') {
      return { reason: 'network' };
    }
    if (typeof err === 'object' && err !== null && 'ok' in err) {
      const failure = err as OverpassMirrorAttemptResult;
      if (!failure.ok && failure.reason === 'rate_limited') return { reason: 'rate_limited' };
      if (!failure.ok && failure.reason === 'empty') return { reason: 'empty' };
    }
    return { reason: 'network' };
  } finally {
    if (overallTimer !== undefined) clearTimeout(overallTimer);
    if (!settled) abortLosers();
  }
}
