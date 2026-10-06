type Listener = () => void;

let revision = 0;
const listeners = new Set<Listener>();

/** Bumped when MealDB kitchen recipe caches change (lookups, category snapshots). */
export function mealDbKitchenCacheRevision(): number {
  return revision;
}

export function notifyMealDbKitchenCacheChanged(): void {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMealDbKitchenCacheChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetMealDbKitchenCacheNotifyForTests(): void {
  revision = 0;
  listeners.clear();
}
