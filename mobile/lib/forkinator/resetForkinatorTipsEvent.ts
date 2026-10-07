const listeners = new Set<() => void>();

export function subscribeForkinatorTipsReset(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitForkinatorTipsReset(): void {
  for (const listener of listeners) {
    listener();
  }
}
