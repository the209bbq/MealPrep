export type MealDbLookupPriority = 'user-visible' | 'background';

const MAX_IN_FLIGHT = 4;
const LOOKUP_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;

let inFlight = 0;
let userVisibleDepth = 0;

interface QueueJob {
  priority: MealDbLookupPriority;
  run: () => Promise<void>;
}

const queue: QueueJob[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterMs(max = 250): number {
  return Math.floor(Math.random() * max);
}

function canStartJob(job: QueueJob): boolean {
  if (job.priority === 'user-visible') return true;
  if (userVisibleDepth > 0) return false;
  return !queue.some((candidate) => candidate.priority === 'user-visible');
}

function pumpQueue(): void {
  while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {
    const index = queue.findIndex((job) => canStartJob(job));
    if (index < 0) return;
    const [job] = queue.splice(index, 1);
    inFlight += 1;
    void job.run().finally(() => {
      inFlight -= 1;
      pumpQueue();
    });
  }
}

export function runMealDbLookupTask<T>(
  priority: MealDbLookupPriority,
  task: () => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push({
      priority,
      run: async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      },
    });
    pumpQueue();
  });
}

/** While open category feed (or similar) is resolving visible cards. */
export async function withMealDbUserVisibleLookups<T>(fn: () => Promise<T>): Promise<T> {
  userVisibleDepth += 1;
  try {
    return await fn();
  } finally {
    userVisibleDepth -= 1;
    pumpQueue();
  }
}

export async function fetchMealDbLookupWithRetries<T>(
  priority: MealDbLookupPriority,
  fetchOnce: () => Promise<T | null>,
): Promise<T | null> {
  for (let attempt = 0; attempt < LOOKUP_RETRY_DELAYS_MS.length; attempt += 1) {
    const result = await runMealDbLookupTask(priority, fetchOnce);
    if (result !== null) return result;
    if (attempt < LOOKUP_RETRY_DELAYS_MS.length - 1) {
      await sleep(LOOKUP_RETRY_DELAYS_MS[attempt] + jitterMs());
    }
  }
  return null;
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
