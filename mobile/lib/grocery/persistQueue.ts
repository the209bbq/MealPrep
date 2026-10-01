let chain: Promise<unknown> = Promise.resolve();

/** Serialize grocery persistence so concurrent rebuilds and meal-plan adds cannot race. */
export function enqueueGroceryPersist<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(() => task());
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
