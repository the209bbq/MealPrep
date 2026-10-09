/**
 * Lets a screen open the "Can't decide?" quiz, which is owned by the Forky overlay.
 * The Home "Help me pick" card calls `requestForkInRoadQuiz`; the overlay listens.
 */
const listeners = new Set<() => void>();

export function subscribeForkInRoadQuizRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestForkInRoadQuiz(): void {
  for (const listener of listeners) {
    listener();
  }
}
