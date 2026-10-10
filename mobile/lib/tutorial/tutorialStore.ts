/**
 * State of the first-time tour, shared by the overlay, the screens that register something to
 * light up, the account menu and Forky. No React here so it can be checked on its own.
 */
import { TUTORIAL, TUTORIAL_STEPS, type TutorialTargetId } from '../../config/tutorial';
import { readJson, writeJson } from '../storage';

export const TUTORIAL_DONE_STORAGE_KEY = 'mealprep.tutorial.done';

export type TutorialState = {
  active: boolean;
  stepIndex: number;
};

export type TutorialRect = { x: number; y: number; width: number; height: number };
/** Asks a mounted screen where its element is right now; answers null when it cannot tell. */
export type TutorialMeasure = (done: (rect: TutorialRect | null) => void) => void;

let state: TutorialState = { active: false, stepIndex: 0 };
const listeners = new Set<() => void>();
const targets = new Map<TutorialTargetId, TutorialMeasure>();

function publish(next: TutorialState): void {
  if (next.active === state.active && next.stepIndex === state.stepIndex) return;
  state = next;
  for (const listener of listeners) listener();
}

export function getTutorialState(): TutorialState {
  return state;
}

export function subscribeTutorial(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readTutorialDone(): boolean {
  return readJson<boolean>(TUTORIAL_DONE_STORAGE_KEY, false) === true;
}

/** Finishing and skipping both count: the tour does not come back by itself. */
function markTutorialDone(): void {
  writeJson(TUTORIAL_DONE_STORAGE_KEY, true);
}

let autoStartConsidered = false;

/** Opens the tour at the first step. Does nothing while it is already open. */
export function startTutorial(): void {
  if (state.active) return;
  publish({ active: true, stepIndex: 0 });
}

/**
 * The automatic start for a new visitor, at most once per app load. (Found live on 2026-10-10:
 * re-checking on every screen change restarted the tour from step 1 each time it moved to a new tab.)
 */
export function autoStartTutorialOnce(): boolean {
  if (autoStartConsidered) return false;
  autoStartConsidered = true;
  if (state.active || !shouldAutoStartTutorial()) return false;
  startTutorial();
  return true;
}

export function nextTutorialStep(): void {
  if (!state.active) return;
  if (state.stepIndex >= TUTORIAL_STEPS.length - 1) {
    endTutorial();
    return;
  }
  publish({ active: true, stepIndex: state.stepIndex + 1 });
}

export function previousTutorialStep(): void {
  if (!state.active || state.stepIndex === 0) return;
  publish({ active: true, stepIndex: state.stepIndex - 1 });
}

/** Skip, Done, or leaving the tour any other way. */
export function endTutorial(): void {
  markTutorialDone();
  publish({ active: false, stepIndex: 0 });
}

/** Whether the tour should open by itself for this visitor. */
export function shouldAutoStartTutorial(input: { liveForEveryone?: boolean; done?: boolean } = {}): boolean {
  const live = input.liveForEveryone ?? TUTORIAL.liveForEveryone;
  const done = input.done ?? readTutorialDone();
  return live && !done;
}

/** Whether the account menu offers the tour to this account. */
export function canOpenTutorialFromAccount(input: { isAdmin: boolean; liveForEveryone?: boolean }): boolean {
  return (input.liveForEveryone ?? TUTORIAL.liveForEveryone) || input.isAdmin;
}

export function registerTutorialTarget(id: TutorialTargetId, measure: TutorialMeasure): () => void {
  targets.set(id, measure);
  return () => {
    if (targets.get(id) === measure) targets.delete(id);
  };
}

export function measureTutorialTarget(id: TutorialTargetId, done: (rect: TutorialRect | null) => void): void {
  const measure = targets.get(id);
  if (!measure) {
    done(null);
    return;
  }
  try {
    measure(done);
  } catch {
    done(null);
  }
}

/**
 * The lit-up area for a measured element, or null when the element is not usefully on screen
 * (not mounted, zero size, scrolled away, under the tab bar). With null the tour still shows
 * Forky's card over a fully greyed page, so a step is never lost to a bad measurement.
 */
export function spotlightForRect(
  rect: TutorialRect | null,
  screen: { width: number; height: number; bottomBarHeight: number },
  padding: number = TUTORIAL.spotlightPaddingPx,
): TutorialRect | null {
  if (!rect) return null;
  if (![rect.x, rect.y, rect.width, rect.height].every((n) => Number.isFinite(n))) return null;
  if (rect.width < 8 || rect.height < 8) return null;
  const visibleBottom = screen.height - screen.bottomBarHeight;
  if (rect.y < 0 || rect.y + rect.height > visibleBottom) return null;
  if (rect.x + rect.width <= 0 || rect.x >= screen.width) return null;
  const x = Math.max(0, rect.x - padding);
  const y = Math.max(0, rect.y - padding);
  const right = Math.min(screen.width, rect.x + rect.width + padding);
  const bottom = Math.min(visibleBottom, rect.y + rect.height + padding);
  return { x, y, width: right - x, height: bottom - y };
}

/** Where Forky's card goes: under the lit-up area when that is in the top half, else above it. */
export function tutorialCardPlacement(
  spotlight: TutorialRect | null,
  screen: { height: number; bottomBarHeight: number },
): { anchor: 'top'; top: number } | { anchor: 'bottom'; bottom: number } | { anchor: 'middle' } {
  if (!spotlight) return { anchor: 'middle' };
  const usable = screen.height - screen.bottomBarHeight;
  const center = spotlight.y + spotlight.height / 2;
  if (center < usable / 2) return { anchor: 'top', top: spotlight.y + spotlight.height + 14 };
  return { anchor: 'bottom', bottom: screen.height - spotlight.y + 14 };
}

/** Test helper. */
export function resetTutorialForTests(): void {
  state = { active: false, stepIndex: 0 };
  autoStartConsidered = false;
  targets.clear();
  listeners.clear();
}
