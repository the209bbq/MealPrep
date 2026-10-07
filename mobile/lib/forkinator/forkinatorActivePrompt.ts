export type ForkinatorAutoPromptKind =
  | 'greeting'
  | 'expiration'
  | 'restock'
  | 'aisleSort'
  | 'scanner'
  | 'forkInRoad';

/** Higher number wins when replacing an active auto prompt. */
export const FORKINATOR_AUTO_PROMPT_PRIORITY: Record<ForkinatorAutoPromptKind, number> = {
  greeting: 100,
  expiration: 90,
  restock: 85,
  aisleSort: 50,
  scanner: 40,
  forkInRoad: 40,
};

export function shouldReplaceForkinatorAutoPrompt(
  current: ForkinatorAutoPromptKind | null,
  next: ForkinatorAutoPromptKind,
): boolean {
  if (!current) return true;
  return FORKINATOR_AUTO_PROMPT_PRIORITY[next] >= FORKINATOR_AUTO_PROMPT_PRIORITY[current];
}
