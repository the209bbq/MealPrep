export type MealDbLookupPriority = 'user-visible' | 'background';

const MAX_IN_FLIGHT = 4;
const LOOKUP_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;
/** Per-lookup slot timeout so a hung fetch cannot hold the scheduler forever. */
export const MEALDB_LOOKUP_SLOT_TIMEOUT_MS = 10_000;

let inFlight = 0;
let userVisibleDepth = 0;

interface QueueJob {
  priority: MealDbLookupPriority;
  run: () => Promise<void>;
  signal?: AbortSignal;
  /** When set, background jobs can be promoted for a later user-visible deduped fetch. */
  dedupeKey?: string;
}

const queue: QueueJob[] = [];

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterMs(max = 250): number {
  return Math.floor(Math.random() * max);
}

function isJobAborted(job: QueueJob): boolean {
  return Boolean(job.signal?.aborted);
}

function canStartJob(job: QueueJob): boolean {
  if (isJobAborted(job)) return false;
  if (job.priority === 'user-visible') return true;
  if (userVisibleDepth > 0) return false;
  return !queue.some((candidate) => candidate.priority === 'user-visible' && !isJobAborted(candidate));
}

function rejectAbortedQueuedJobs(): void {
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const job = queue[index];
    if (!isJobAborted(job)) continue;
    queue.splice(index, 1);
    void job.run();
  }
}

function pumpQueue(): void {
  rejectAbortedQueuedJobs();
  while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {
    const index = queue.findIndex((job) => canStartJob(job));
    if (index < 0) return;
    const [job] = queue.splice(index, 1);
    if (isJobAborted(job)) {
      void job.run();
      continue;
    }
    inFlight += 1;
    void job
      .run()
      .catch(() => {
        // run() settles its promise; swallow to avoid unhandled rejection.
      })
      .finally(() => {
        inFlight -= 1;
        pumpQueue();
      });
  }
}

export function runMealDbLookupTask<T>(
  priority: MealDbLookupPriority,
  task: () => Promise<T>,
  options?: { signal?: AbortSignal; dedupeKey?: string },
): Promise<T> {
  const signal = options?.signal;
  if (signal?.aborted) {
    return Promise.reject(abortError(signal));
  }

  return new Promise((resolve, reject) => {
    const job: QueueJob = {
      priority,
      signal,
      dedupeKey: options?.dedupeKey,
      run: async () => {
        if (signal?.aborted) {
          reject(abortError(signal));
          return;
        }
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      },
    };
    queue.push(job);
    pumpQueue();
  });
}

export async function withMealDbLookupSlotTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw abortError(signal);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('MealDB lookup slot timed out'));
        }, timeoutMs);
      }),
      new Promise<T>((_, reject) => {
        if (!signal) return;
        signal.addEventListener(
          'abort',
          () => {
            reject(abortError(signal));
          },
          { once: true },
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** While open category feed (or similar) is resolving visible cards. */
export async function withMealDbUserVisibleLookups<T>(fn: () => Promise<T>): Promise<T> {
  userVisibleDepth += 1;
  try {
    return await fn();
  } finally {
    userVisibleDepth = Math.max(0, userVisibleDepth - 1);
    pumpQueue();
  }
}

/**
 * Scoped user-visible depth (for category feeds that can abort before lookups finish).
 * Call release() in a finally block so depth cannot leak on unmount.
 */
export function beginMealDbUserVisibleLookups(): () => void {
  userVisibleDepth += 1;
  return () => {
    userVisibleDepth = Math.max(0, userVisibleDepth - 1);
    pumpQueue();
  };
}

export interface MealDbLookupFetchOptions {
  signal?: AbortSignal;
  dedupeKey?: string;
}

/** Promote a queued background lookup so user-visible work sharing its dedupe key can run. */
export function promoteMealDbLookupDedupeKey(dedupeKey: string): void {
  for (const job of queue) {
    if (job.dedupeKey === dedupeKey && job.priority === 'background') {
      job.priority = 'user-visible';
    }
  }
  pumpQueue();
}

export async function fetchMealDbLookupWithRetries<T>(
  priority: MealDbLookupPriority,
  fetchOnce: () => Promise<T | null>,
  options?: MealDbLookupFetchOptions,
): Promise<T | null> {
  const signal = options?.signal;
  if (signal?.aborted) return null;

  return runMealDbLookupTask(
    priority,
    async () => {
      const maxAttempts = LOOKUP_RETRY_DELAYS_MS.length + 1;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) return null;
        const result = await fetchOnce();
        if (result !== null) return result;
        if (attempt < LOOKUP_RETRY_DELAYS_MS.length) {
          await sleep(LOOKUP_RETRY_DELAYS_MS[attempt] + jitterMs());
        }
      }
      return null;
    },
    { signal, dedupeKey: options?.dedupeKey },
  );
}

/** Test helpers */
export function resetMealDbLookupSchedulerForTests(): void {
  queue.length = 0;
  inFlight = 0;
  userVisibleDepth = 0;
}

export function mealDbLookupSchedulerStatsForTests(): {
  inFlight: number;
  queued: number;
  userVisibleDepth: number;
} {
  return { inFlight, queued: queue.length, userVisibleDepth };
}
