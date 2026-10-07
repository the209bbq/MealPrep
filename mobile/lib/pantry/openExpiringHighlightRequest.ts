let pendingHighlightIds: string[] | null = null;

const listeners = new Set<() => void>();

export function subscribePantryExpiringHighlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestPantryExpiringHighlight(itemIds: readonly string[]): void {
  pendingHighlightIds = [...itemIds];
  for (const listener of listeners) {
    listener();
  }
}

export function consumePantryExpiringHighlightRequest(): string[] | null {
  if (!pendingHighlightIds?.length) return null;
  const ids = pendingHighlightIds;
  pendingHighlightIds = null;
  return ids;
}
