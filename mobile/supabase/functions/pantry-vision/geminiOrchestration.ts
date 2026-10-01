/**
 * Gemini model ordering and request time budget for pantry-vision.
 * Unit-tested from mobile/scripts (tsx); imported by index.ts in this folder.
 */

/** @sync mobile/config/geminiVision.ts */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
export const DEFAULT_GEMINI_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
] as const;

/** Per upstream HTTP call (each Gemini generateContent). */
export const GEMINI_REQUEST_TIMEOUT_MS = 22_000;

/** Shared wall-clock budget for one pantry-vision HTTP request (under Supabase ~150s limit). */
export const GEMINI_REQUEST_TOTAL_BUDGET_MS = 110_000;

/** Do not start a new Gemini call when less than this remains on the budget. */
export const GEMINI_MIN_PER_CALL_TIMEOUT_MS = 2_500;

export const MODEL_TIMEOUT_DEPRIORITIZE_MS = 5 * 60 * 1000;

export const GEMINI_HTTP_RETRIES_PER_MODEL = 2;

export function parseCommaSeparatedModels(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function buildGeminiModelCandidates(
  primaryFromEnv: string | undefined,
  fallbacksFromEnv: string | undefined,
): string[] {
  const primary =
    (primaryFromEnv ?? DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const fromSecret = parseCommaSeparatedModels(fallbacksFromEnv);
  const ordered = [primary, ...fromSecret, ...DEFAULT_GEMINI_FALLBACK_MODELS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const model of ordered) {
    if (seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

export function deprioritizeRecentlyTimedOutModels(
  candidates: string[],
  timedOutAt: ReadonlyMap<string, number>,
  nowMs: number,
  ttlMs: number = MODEL_TIMEOUT_DEPRIORITIZE_MS,
): string[] {
  const fresh: string[] = [];
  const deprioritized: string[] = [];
  for (const model of candidates) {
    const at = timedOutAt.get(model);
    if (at != null && nowMs - at < ttlMs) {
      deprioritized.push(model);
    } else {
      fresh.push(model);
    }
  }
  return [...fresh, ...deprioritized];
}

export class ModelTimeoutMemory {
  private readonly timedOutAt = new Map<string, number>();

  record(model: string, nowMs: number = Date.now()): void {
    this.timedOutAt.set(model, nowMs);
  }

  orderCandidates(candidates: string[], nowMs: number = Date.now()): string[] {
    return deprioritizeRecentlyTimedOutModels(candidates, this.timedOutAt, nowMs);
  }
}

export class RequestTimeBudget {
  private readonly startedAtMs: number;

  constructor(
    private readonly totalMs: number,
    private readonly nowFn: () => number = Date.now,
  ) {
    this.startedAtMs = nowFn();
  }

  elapsedMs(): number {
    return this.nowFn() - this.startedAtMs;
  }

  remainingMs(): number {
    return Math.max(0, this.totalMs - this.elapsedMs());
  }

  isExhausted(): boolean {
    return this.remainingMs() < GEMINI_MIN_PER_CALL_TIMEOUT_MS;
  }

  /** Milliseconds for the next AbortSignal.timeout, or null if the budget is too low. */
  perCallTimeoutMs(capMs: number = GEMINI_REQUEST_TIMEOUT_MS): number | null {
    const remaining = this.remainingMs();
    if (remaining < GEMINI_MIN_PER_CALL_TIMEOUT_MS) return null;
    return Math.min(capMs, remaining);
  }
}

export type GeminiRetryableErrorKind = 'timeout' | 'http';

export function shouldRetrySameModelAfterError(
  error: { kind: GeminiRetryableErrorKind; retryable?: boolean },
  httpRetriesUsed: number,
  maxHttpRetries: number = GEMINI_HTTP_RETRIES_PER_MODEL,
): boolean {
  if (error.kind === 'timeout') return false;
  if (error.kind === 'http' && error.retryable) {
    return httpRetriesUsed < maxHttpRetries - 1;
  }
  return false;
}

export function orderModelsForAttempt(
  primaryFromEnv: string | undefined,
  fallbacksFromEnv: string | undefined,
  timeoutMemory: ModelTimeoutMemory,
  nowMs: number = Date.now(),
): string[] {
  const base = buildGeminiModelCandidates(primaryFromEnv, fallbacksFromEnv);
  return timeoutMemory.orderCandidates(base, nowMs);
}
