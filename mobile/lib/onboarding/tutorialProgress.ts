export type HandsOnTutorialStepId = 'scan' | 'recipes' | 'grocery' | 'shop';

export const HANDS_ON_TUTORIAL_STEP_ORDER: readonly HandsOnTutorialStepId[] = [
  'scan',
  'recipes',
  'grocery',
  'shop',
];

export type HandsOnTutorialStepStatus = 'pending' | 'done' | 'skipped';

export type HandsOnTutorialProgress = {
  /** Index into HANDS_ON_TUTORIAL_STEP_ORDER, or 4 when showing the recap screen. */
  activeIndex: number;
  steps: Record<HandsOnTutorialStepId, HandsOnTutorialStepStatus>;
  /** User left the coach modal to complete the current step in the app. */
  taskInProgress: boolean;
};

export const TUTORIAL_RECAP_INDEX = HANDS_ON_TUTORIAL_STEP_ORDER.length;

export function defaultTutorialProgress(): HandsOnTutorialProgress {
  return {
    activeIndex: 0,
    taskInProgress: false,
    steps: {
      scan: 'pending',
      recipes: 'pending',
      grocery: 'pending',
      shop: 'pending',
    },
  };
}

export function normalizeTutorialProgress(raw: Partial<HandsOnTutorialProgress> | null): HandsOnTutorialProgress {
  const base = defaultTutorialProgress();
  if (!raw) return base;
  const steps = { ...base.steps, ...raw.steps };
  const activeIndex =
    typeof raw.activeIndex === 'number' && raw.activeIndex >= 0 && raw.activeIndex <= TUTORIAL_RECAP_INDEX
      ? raw.activeIndex
      : base.activeIndex;
  return {
    activeIndex,
    taskInProgress: Boolean(raw.taskInProgress),
    steps,
  };
}

export function firstIncompleteStepIndex(progress: HandsOnTutorialProgress): number {
  for (let i = 0; i < HANDS_ON_TUTORIAL_STEP_ORDER.length; i++) {
    const id = HANDS_ON_TUTORIAL_STEP_ORDER[i];
    if (progress.steps[id] === 'pending') return i;
  }
  return TUTORIAL_RECAP_INDEX;
}

export function resumeActiveIndex(progress: HandsOnTutorialProgress): number {
  const resume = firstIncompleteStepIndex(progress);
  if (resume === TUTORIAL_RECAP_INDEX) return TUTORIAL_RECAP_INDEX;
  return Math.min(progress.activeIndex, resume);
}

export function markStepDone(
  progress: HandsOnTutorialProgress,
  stepId: HandsOnTutorialStepId,
): HandsOnTutorialProgress {
  const nextSteps = { ...progress.steps, [stepId]: 'done' as const };
  const next: HandsOnTutorialProgress = {
    ...progress,
    steps: nextSteps,
    taskInProgress: false,
    activeIndex: firstIncompleteStepIndex({ ...progress, steps: nextSteps }),
  };
  return next;
}

export function markStepSkipped(
  progress: HandsOnTutorialProgress,
  stepId: HandsOnTutorialStepId,
): HandsOnTutorialProgress {
  const nextSteps = { ...progress.steps, [stepId]: 'skipped' as const };
  return {
    ...progress,
    steps: nextSteps,
    taskInProgress: false,
    activeIndex: firstIncompleteStepIndex({ ...progress, steps: nextSteps }),
  };
}

export function currentStepId(progress: HandsOnTutorialProgress): HandsOnTutorialStepId | null {
  if (progress.activeIndex >= TUTORIAL_RECAP_INDEX) return null;
  return HANDS_ON_TUTORIAL_STEP_ORDER[progress.activeIndex] ?? null;
}

export function allTutorialStepsSkipped(progress: HandsOnTutorialProgress): boolean {
  return HANDS_ON_TUTORIAL_STEP_ORDER.every((id) => progress.steps[id] === 'skipped');
}

export function isTutorialRecapScreen(progress: HandsOnTutorialProgress): boolean {
  return progress.activeIndex >= TUTORIAL_RECAP_INDEX;
}
