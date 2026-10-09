/**
 * Lets a screen (the Home "Help me pick" card) ask Forky to open the existing
 * fork-in-the-road quiz. ForkinatorOverlay owns the quiz state and subscribes here,
 * so there is still only one quiz in the app.
 */
const listeners = new Set<() => void>();

export function subscribeForkInRoadQuizRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Returns true when a mounted Forky overlay received the request. */
export function requestForkInRoadQuiz(): boolean {
  if (listeners.size === 0) return false;
  for (const listener of listeners) {
    listener();
  }
  return true;
}
