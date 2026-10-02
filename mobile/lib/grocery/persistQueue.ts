let chain: Promise<unknown> = Promise.resolve();
let persistGeneration = 0;

/** Bump when kitchen data is cleared so in-flight grocery persists are skipped. */
export function bumpGroceryPersistGeneration(): number {
  persistGeneration += 1;
  return persistGeneration;
}

export function currentGroceryPersistGeneration(): number {
  return persistGeneration;
}

/** Serialize grocery persistence so concurrent rebuilds and meal-plan adds cannot race. */
export function enqueueGroceryPersist<T>(
  task: () => Promise<T>,
  generation = persistGeneration,
): Promise<T | undefined> {
  const run = chain.then(async () => {
    if (generation !== persistGeneration) return undefined;
    return task();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
