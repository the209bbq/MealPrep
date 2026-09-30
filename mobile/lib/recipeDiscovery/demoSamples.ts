import type { RecipeApiRecipe, RecipeDiscoveryListItem } from './types';

const DEMO_RECIPE_BASE: RecipeApiRecipe[] = [
  {
    id: 900001,
    name: 'Demo: Lemon Herb Chicken Bowls',
    description:
      'Sample result only — not from RecipeAPI.io. Shows how discover search and import work in demo mode.',
    difficulty: 'easy',
    meal_type: 'main',
    cuisine: 'american',
    dietary_tags: ['gluten_free'],
    servings: 4,
    prep_time: 15,
    cook_time: 25,
    calories_per_serving: 420,
    protein: 38,
    carbs: 28,
    fat: 14,
    instructions: [
      'Season chicken with lemon zest, garlic, salt, and pepper.',
      'Roast at 425°F until cooked through.',
      'Serve over rice with steamed broccoli.',
    ],
    ingredients: [
      { id: 1, name: 'Chicken breast', category: 'meat', quantity: 24, unit: 'oz', optional: false },
      { id: 2, name: 'Lemon', category: 'fruit', quantity: 2, unit: 'each', optional: false },
      { id: 3, name: 'Broccoli', category: 'vegetable', quantity: 12, unit: 'oz', optional: false },
    ],
  },
  {
    id: 900002,
    name: 'Demo: Weeknight Veggie Pasta',
    description: 'Sample result only — labeled for demo mode. Search the live API after deploying the proxy.',
    difficulty: 'medium',
    meal_type: 'main',
    cuisine: 'italian',
    dietary_tags: ['vegetarian'],
    servings: 6,
    prep_time: 10,
    cook_time: 20,
    calories_per_serving: 510,
    protein: 18,
    carbs: 72,
    fat: 16,
    instructions: [
      'Boil pasta until al dente.',
      'Sauté zucchini and cherry tomatoes in olive oil.',
      'Toss pasta with vegetables and parmesan.',
    ],
    ingredients: [
      { id: 4, name: 'Penne', category: 'grain', quantity: 1, unit: 'lb', optional: false },
      { id: 5, name: 'Zucchini', category: 'vegetable', quantity: 2, unit: 'each', optional: false },
      { id: 6, name: 'Parmesan', category: 'dairy', quantity: 4, unit: 'oz', optional: false },
    ],
  },
  {
    id: 900003,
    name: 'Demo: Coconut Curry Soup',
    description: 'Sample result only — use Supabase + RECIPEAPI_KEY for real RecipeAPI.io data.',
    difficulty: 'easy',
    meal_type: 'soup',
    cuisine: 'thai',
    dietary_tags: ['vegan', 'gluten_free'],
    servings: 4,
    prep_time: 12,
    cook_time: 18,
    calories_per_serving: 290,
    protein: 8,
    carbs: 24,
    fat: 18,
    instructions: [
      'Simmer coconut milk with curry paste and ginger.',
      'Add chickpeas and spinach until wilted.',
      'Finish with lime juice and cilantro.',
    ],
    ingredients: [
      { id: 7, name: 'Coconut milk', category: 'dairy', quantity: 2, unit: 'can', optional: false },
      { id: 8, name: 'Chickpeas', category: 'legume', quantity: 15, unit: 'oz', optional: false },
      { id: 9, name: 'Spinach', category: 'vegetable', quantity: 6, unit: 'oz', optional: false },
    ],
  },
];

export function filterDemoRecipes(search: string, filters: { cuisine?: string; difficulty?: string }): RecipeDiscoveryListItem[] {
  const term = search.trim().toLowerCase();
  return DEMO_RECIPE_BASE.filter((recipe) => {
    if (filters.cuisine && recipe.cuisine !== filters.cuisine) return false;
    if (filters.difficulty && recipe.difficulty !== filters.difficulty) return false;
    if (!term) return true;
    return (
      recipe.name.toLowerCase().includes(term) ||
      recipe.description.toLowerCase().includes(term)
    );
  }).map((r) => ({ ...r, isDemoSample: true }));
}

export function getDemoRecipeById(id: number): RecipeDiscoveryListItem | null {
  const hit = DEMO_RECIPE_BASE.find((r) => r.id === id);
  return hit ? { ...hit, isDemoSample: true } : null;
}
