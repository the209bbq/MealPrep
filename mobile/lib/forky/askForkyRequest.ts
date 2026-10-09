import { ASK_FORKY_LIMITS } from '../../config/askForky';

// Pure: builds what is sent to the server. Kept free of app imports so it can be unit-tested.

export interface AskForkyTurn {
  role: 'user' | 'forky';
  text: string;
}

export interface AskForkyPantryInput {
  name: string;
  quantity: number;
  unit: string;
  expiresOn: string | null;
}

export interface AskForkyRecipeInput {
  recipeId: string;
  recipeName: string;
  totalIngredients: number;
  matchedCount: number;
  missing: { name: string }[];
}

export interface AskForkyContext {
  pantry: AskForkyPantryInput[];
  /** Already ranked best-first by the app's pantry matching. */
  recipes: AskForkyRecipeInput[];
}

function amountText(quantity: number, unit: string): string {
  if (!Number.isFinite(quantity) || quantity <= 0) return '';
  const rounded = Math.round(quantity * 100) / 100;
  return `${rounded} ${unit}`.trim();
}

/**
 * Only what Forky needs: item names, amounts and use-by dates, and a short list of recipe titles.
 * No ids of the user, no photos, no notes. Items that expire soonest go first so they survive the cap.
 */
export function buildAskForkyBody(question: string, history: AskForkyTurn[], context: AskForkyContext) {
  const pantry = [...context.pantry]
    .sort((a, b) => {
      if (a.expiresOn && b.expiresOn) return a.expiresOn.localeCompare(b.expiresOn);
      if (a.expiresOn) return -1;
      if (b.expiresOn) return 1;
      return 0;
    })
    .slice(0, ASK_FORKY_LIMITS.pantryItems)
    .map((item) => {
      const amount = amountText(item.quantity, item.unit);
      return {
        name: item.name,
        ...(amount ? { amount } : {}),
        ...(item.expiresOn ? { expiresOn: item.expiresOn.slice(0, 10) } : {}),
      };
    });

  const recipes = context.recipes.slice(0, ASK_FORKY_LIMITS.recipes).map((match) => ({
    id: match.recipeId,
    title: match.recipeName,
    have: match.matchedCount,
    total: match.totalIngredients,
    missing: match.missing.slice(0, 6).map((ingredient) => ingredient.name),
  }));

  return {
    question: question.trim(),
    history: history.slice(-ASK_FORKY_LIMITS.historyTurns).map((turn) => ({ role: turn.role, text: turn.text })),
    pantry,
    recipes,
  };
}
