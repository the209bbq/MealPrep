/** Continuous idle time on Home before the decision-helper prompt may appear. */
export const FORKINATOR_FORK_IN_ROAD_HOME_IDLE_MS = 10_000;

let homeFocused = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function clearIdleTimer(): void {
  if (idleTimer != null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleTimer(): void {
  clearIdleTimer();
  if (!homeFocused) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    for (const listener of listeners) {
      listener();
    }
  }, FORKINATOR_FORK_IN_ROAD_HOME_IDLE_MS);
}

export function setForkInRoadHomeFocused(focused: boolean): void {
  homeFocused = focused;
  if (!focused) {
    clearIdleTimer();
    return;
  }
  scheduleIdleTimer();
}

export function resetForkInRoadHomeIdleTimer(): void {
  if (!homeFocused) return;
  scheduleIdleTimer();
}

export function subscribeForkInRoadHomeIdleReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
