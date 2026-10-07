import {
  applyRecipesTabFilters,
  recipesTabRowMinutes,
  type RecipesTabFilterState,
  type RecipesTabRow,
} from '../../config/recipesTabFilters';
import { recipesTabKitchenDifficulty } from '../../config/recipesTabFilterDifficulty';
import type { Recipe } from '../../types/mealprep';
import type { RecipePantryMatch } from '../recipeMatch';

export type ForkInRoadMood = 'fast' | 'fancy' | 'comfort';
export type ForkInRoadPantryPref = 'use_pantry' | 'dont_care';
export type ForkInRoadProtein =
  | 'chicken'
  | 'beef'
  | 'pork'
  | 'seafood'
  | 'veggie'
  | 'surprise';

export interface ForkInRoadQuizAnswers {
  mood: ForkInRoadMood;
  pantry: ForkInRoadPantryPref;
  protein: ForkInRoadProtein;
}

const PROTEIN_PATTERNS: Record<Exclude<ForkInRoadProtein, 'surprise'>, RegExp> = {
  chicken: /\b(chicken|poultry|turkey)\b/i,
  beef: /\b(beef|steak|brisket|ground beef)\b/i,
  pork: /\b(pork|bacon|ham|sausage|prosciutto)\b/i,
  seafood: /\b(fish|salmon|shrimp|tuna|cod|crab|lobster|seafood)\b/i,
  veggie: /\b(vegetarian|veggie|tofu|lentil|chickpea|bean|mushroom)\b/i,
};

const COMFORT_PATTERN =
  /\b(mac and cheese|meatloaf|pot pie|mashed|soup|stew|chili|casserole|gratin|lasagna|shepherd|comfort)\b/i;

export function recipeHaystack(recipe: Recipe): string {
  const ingredientNames = recipe.ingredients.map((row) => row.name).join(' ');
  return `${recipe.name} ${recipe.description} ${recipe.tag} ${ingredientNames}`;
}

export function recipeMatchesProtein(recipe: Recipe, protein: ForkInRoadProtein): boolean {
  if (protein === 'surprise') return true;
  return PROTEIN_PATTERNS[protein].test(recipeHaystack(recipe));
}

export function scoreForkInRoadKitchenRecipe(
  recipe: Recipe,
  match: RecipePantryMatch,
  answers: ForkInRoadQuizAnswers,
): number {
  let score = 0;
  const minutes = recipe.minutes;
  const difficulty = recipesTabKitchenDifficulty(recipe);
  const haystack = recipeHaystack(recipe);

  if (answers.mood === 'fast') {
    if (minutes <= 20) score += 40;
    else if (minutes <= 30) score += 28;
    else if (minutes <= 45) score += 12;
    else score -= 10;
  } else if (answers.mood === 'fancy') {
    if (difficulty === 'hard') score += 35;
    else if (difficulty === 'medium') score += 18;
    if ((recipe.ingredients?.length ?? 0) >= 10) score += 10;
  } else {
    if (COMFORT_PATTERN.test(haystack)) score += 30;
    if (difficulty === 'easy' || difficulty === 'medium') score += 12;
  }

  if (answers.pantry === 'use_pantry') {
    score += Math.round(match.percentMatch * 0.5);
    if (match.missingCount === 0) score += 20;
    else if (match.missingCount <= 2) score += 8;
  }

  if (answers.protein !== 'surprise') {
    score += recipeMatchesProtein(recipe, answers.protein) ? 25 : -15;
  } else {
    score += 5;
  }

  return score;
}

export function buildForkInRoadCandidateRows(options: {
  kitchenRecipes: readonly Recipe[];
  pantryMatches: { byRecipeId: Map<string, RecipePantryMatch> };
  filterState: RecipesTabFilterState;
}): RecipesTabRow[] {
  const rows: RecipesTabRow[] = options.kitchenRecipes.map((recipe) => ({
    kind: 'kitchen',
    recipe,
    match:
      options.pantryMatches.byRecipeId.get(recipe.id) ?? {
        recipeId: recipe.id,
        recipeName: recipe.name,
        totalIngredients: recipe.ingredients.length,
        matchedCount: 0,
        missingCount: recipe.ingredients.length,
        percentMatch: 0,
        matched: [],
        missing: recipe.ingredients,
      },
  }));
  return applyRecipesTabFilters(rows, options.filterState);
}

export function pickForkInRoadRecipes(
  rows: readonly RecipesTabRow[],
  answers: ForkInRoadQuizAnswers,
  limit = 3,
): RecipesTabRow[] {
  const kitchenRows = rows.filter((row) => row.kind === 'kitchen');
  const scored = kitchenRows
    .map((row) => ({
      row,
      score: scoreForkInRoadKitchenRecipe(row.recipe, row.match, answers),
    }))
    .filter((entry) => entry.score > -5)
    .sort((a, b) => b.score - a.score);

  const picks: RecipesTabRow[] = [];
  const seen = new Set<string>();
  for (const entry of scored) {
    if (picks.length >= limit) break;
    const id = entry.row.recipe.id;
    if (seen.has(id)) continue;
    seen.add(id);
    picks.push(entry.row);
  }
  return picks;
}

export function forkInRoadRecipeMinutes(row: RecipesTabRow): number {
  return recipesTabRowMinutes(row);
}
