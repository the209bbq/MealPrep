import type { PantryItem } from '../../types/mealprep';

export const FORKINATOR_EXPIRATION_PROMPT_A11Y_LABEL = 'Dismiss expiration reminder';

export const FORKINATOR_EXPIRATION_SHOW_BUTTON_LABEL = 'Show me';

export const FORKINATOR_EXPIRATION_SHOW_BUTTON_A11Y_LABEL =
  'Show expiring pantry items in pantry';

export function buildForkinatorExpirationPromptMessage(items: readonly PantryItem[]): string {
  const first = items[0]?.name?.trim() || 'Something';
  if (items.length <= 1) {
    return `That ${first} is living on borrowed time! Use it today or tomorrow.`;
  }
  const more = items.length - 1;
  return `That ${first} and ${more} more item${more === 1 ? '' : 's'} are living on borrowed time!`;
}
