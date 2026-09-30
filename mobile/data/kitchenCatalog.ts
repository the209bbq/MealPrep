import type { Recipe, RecipeIngredient } from '../types/mealprep';

/** Mirrors `RECIPE_CATALOG` in New/recipes.js — single source for demo mode and Supabase import. */
export interface KitchenCatalogEntry {
  slug: string;
  tag: string;
  name: string;
  description: string;
  servings: number;
  minutes: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: string[];
  ingredients: RecipeIngredient[];
}

const now = new Date().toISOString();

function ing(
  ingredientId: string,
  name: string,
  quantity: number,
  unit: string,
  notes?: string,
): RecipeIngredient {
  return { ingredientId, name, quantity, unit, ...(notes ? { notes } : {}) };
}

export const KITCHEN_CATALOG: KitchenCatalogEntry[] = [
  {
    slug: 'brisket',
    tag: 'Signature Smoked',
    name: 'Smoked Lean Brisket & Sweet Potato',
    description:
      'Slow-smoked sliced brisket served with roasted sweet potato wedges and steamed green beans.',
    servings: 4,
    minutes: 45,
    calories: 520,
    protein: 45,
    carbs: 38,
    fat: 18,
    steps: ['Prep vegetables', 'Reheat brisket', 'Plate and serve'],
    ingredients: [
      ing('brisket-meat', 'Smoked brisket', 24, 'oz'),
      ing('sweet-potato', 'Sweet potato', 2, 'each'),
      ing('green-beans', 'Green beans', 12, 'oz'),
    ],
  },
  {
    slug: 'lemon-chicken',
    tag: 'Lean & Clean',
    name: 'Grilled Lemon Herb Chicken',
    description: 'Char-grilled chicken breast over Jasmine rice with garlic broccoli and citrus drizzle.',
    servings: 4,
    minutes: 35,
    calories: 480,
    protein: 42,
    carbs: 42,
    fat: 12,
    steps: ['Grill chicken', 'Steam rice', 'Sauté broccoli'],
    ingredients: [
      ing('chicken-breast', 'Chicken breast', 24, 'oz'),
      ing('jasmine-rice', 'Jasmine rice', 2, 'cups'),
      ing('broccoli', 'Broccoli', 16, 'oz'),
    ],
  },
  {
    slug: 'pulled-pork',
    tag: 'Low Carb',
    name: 'Pulled Pork Bowl',
    description:
      'Tender slow-smoked pulled pork served over seasoned cauliflower rice with cilantro-lime slaw.',
    servings: 4,
    minutes: 30,
    calories: 440,
    protein: 38,
    carbs: 22,
    fat: 20,
    steps: ['Warm pork', 'Prepare slaw', 'Assemble bowls'],
    ingredients: [
      ing('pulled-pork', 'Pulled pork', 20, 'oz'),
      ing('cauliflower-rice', 'Cauliflower rice', 4, 'cups'),
      ing('lime', 'Limes', 2, 'each'),
    ],
  },
  {
    slug: 'turkey-rice',
    tag: 'Signature Smoked',
    name: 'Smoked Turkey & Wild Rice',
    description:
      'Sliced smoked turkey breast with wild rice pilaf, roasted carrots, and a light herb gravy.',
    servings: 4,
    minutes: 40,
    calories: 470,
    protein: 44,
    carbs: 45,
    fat: 10,
    steps: ['Cook wild rice pilaf', 'Roast carrots', 'Slice turkey and plate with gravy'],
    ingredients: [
      ing('turkey-breast', 'Smoked turkey breast', 24, 'oz'),
      ing('wild-rice', 'Wild rice blend', 2, 'cups'),
      ing('carrots', 'Carrots', 12, 'oz'),
      ing('herb-gravy', 'Light herb gravy', 8, 'oz'),
    ],
  },
  {
    slug: 'chipotle-shrimp',
    tag: 'Lean & Clean',
    name: 'Chipotle Lime Shrimp',
    description: 'Chili-lime shrimp over cilantro rice with black beans, grilled corn, and avocado salsa.',
    servings: 4,
    minutes: 35,
    calories: 430,
    protein: 36,
    carbs: 48,
    fat: 12,
    steps: ['Cook cilantro rice', 'Sauté shrimp with chipotle-lime', 'Assemble with beans, corn, and salsa'],
    ingredients: [
      ing('shrimp', 'Shrimp', 20, 'oz'),
      ing('cilantro-rice', 'Cilantro rice', 2, 'cups'),
      ing('black-beans', 'Black beans', 2, 'cups'),
      ing('corn', 'Grilled corn', 2, 'cups'),
      ing('avocado-salsa', 'Avocado salsa', 12, 'oz'),
    ],
  },
  {
    slug: 'herb-salmon',
    tag: 'Lean & Clean',
    name: 'Herb Salmon & Asparagus',
    description: 'Oven-finished salmon with garlic asparagus, lemon quinoa, and a dill yogurt sauce.',
    servings: 4,
    minutes: 35,
    calories: 510,
    protein: 40,
    carbs: 36,
    fat: 22,
    steps: ['Roast salmon', 'Cook quinoa and asparagus', 'Finish with dill yogurt sauce'],
    ingredients: [
      ing('salmon', 'Salmon fillet', 24, 'oz'),
      ing('asparagus', 'Asparagus', 16, 'oz'),
      ing('quinoa', 'Lemon quinoa', 2, 'cups'),
      ing('dill-yogurt', 'Dill yogurt sauce', 8, 'oz'),
    ],
  },
  {
    slug: 'steak-tips',
    tag: 'Signature Smoked',
    name: 'Steak Tips & Garlic Potatoes',
    description: 'Smoked sirloin tips with roasted garlic potatoes, green beans, and peppercorn jus.',
    servings: 4,
    minutes: 45,
    calories: 560,
    protein: 46,
    carbs: 40,
    fat: 24,
    steps: ['Reheat steak tips', 'Roast garlic potatoes', 'Steam green beans and add jus'],
    ingredients: [
      ing('sirloin-tips', 'Smoked sirloin tips', 24, 'oz'),
      ing('garlic-potatoes', 'Roasted garlic potatoes', 24, 'oz'),
      ing('green-beans', 'Green beans', 12, 'oz'),
      ing('peppercorn-jus', 'Peppercorn jus', 6, 'oz'),
    ],
  },
  {
    slug: 'buffalo-chicken',
    tag: 'High Protein',
    name: 'Buffalo Chicken Bowl',
    description: 'Grilled chicken tossed in buffalo sauce over rice with celery slaw and ranch drizzle.',
    servings: 4,
    minutes: 30,
    calories: 490,
    protein: 48,
    carbs: 44,
    fat: 14,
    steps: ['Grill and toss chicken in buffalo sauce', 'Cook rice', 'Top with celery slaw and ranch'],
    ingredients: [
      ing('chicken-breast', 'Grilled chicken', 24, 'oz'),
      ing('buffalo-sauce', 'Buffalo sauce', 6, 'oz'),
      ing('jasmine-rice', 'Rice', 2, 'cups'),
      ing('celery-slaw', 'Celery slaw', 12, 'oz'),
      ing('ranch', 'Ranch drizzle', 4, 'oz'),
    ],
  },
  {
    slug: 'carnitas',
    tag: 'Signature Smoked',
    name: 'Carnitas Street Bowl',
    description: 'Crispy smoked carnitas with cilantro-lime rice, pico de gallo, and pickled onions.',
    servings: 4,
    minutes: 35,
    calories: 530,
    protein: 41,
    carbs: 52,
    fat: 18,
    steps: ['Crisp carnitas', 'Cook cilantro-lime rice', 'Assemble with pico and pickled onions'],
    ingredients: [
      ing('carnitas', 'Smoked carnitas', 22, 'oz'),
      ing('cilantro-rice', 'Cilantro-lime rice', 2, 'cups'),
      ing('pico', 'Pico de gallo', 12, 'oz'),
      ing('pickled-onions', 'Pickled onions', 6, 'oz'),
    ],
  },
  {
    slug: 'korean-beef',
    tag: 'Signature Smoked',
    name: 'Korean BBQ Beef',
    description: 'Marinated smoked beef with steamed rice, sesame broccoli, and a gochujang glaze.',
    servings: 4,
    minutes: 40,
    calories: 540,
    protein: 43,
    carbs: 46,
    fat: 20,
    steps: ['Warm smoked beef', 'Steam rice', 'Sauté broccoli with sesame and gochujang glaze'],
    ingredients: [
      ing('korean-beef', 'Marinated smoked beef', 24, 'oz'),
      ing('jasmine-rice', 'Steamed rice', 2, 'cups'),
      ing('broccoli', 'Sesame broccoli', 16, 'oz'),
      ing('gochujang', 'Gochujang glaze', 4, 'oz'),
    ],
  },
  {
    slug: 'smash-burger',
    tag: 'High Protein',
    name: 'Smash Burger Bowl',
    description: 'Seasoned beef, roasted potatoes, pickle slaw, and special sauce without the bun.',
    servings: 4,
    minutes: 35,
    calories: 580,
    protein: 42,
    carbs: 38,
    fat: 28,
    steps: ['Brown seasoned beef', 'Roast potatoes', 'Assemble with pickle slaw and sauce'],
    ingredients: [
      ing('ground-beef', 'Seasoned beef', 24, 'oz'),
      ing('roasted-potatoes', 'Roasted potatoes', 20, 'oz'),
      ing('pickle-slaw', 'Pickle slaw', 12, 'oz'),
      ing('special-sauce', 'Special sauce', 6, 'oz'),
    ],
  },
  {
    slug: 'veggie-power',
    tag: 'Plant Forward',
    name: 'Roasted Veggie Power Bowl',
    description: 'Smoked chickpeas, quinoa, roasted squash, kale, and tahini lemon dressing.',
    servings: 4,
    minutes: 40,
    calories: 460,
    protein: 24,
    carbs: 58,
    fat: 16,
    steps: ['Roast squash and chickpeas', 'Cook quinoa', 'Massage kale and dress with tahini lemon'],
    ingredients: [
      ing('chickpeas', 'Smoked chickpeas', 16, 'oz'),
      ing('quinoa', 'Quinoa', 2, 'cups'),
      ing('squash', 'Roasted squash', 16, 'oz'),
      ing('kale', 'Kale', 12, 'oz'),
      ing('tahini-lemon', 'Tahini lemon dressing', 6, 'oz'),
    ],
  },
];

export function catalogToRecipes(entries: KitchenCatalogEntry[] = KITCHEN_CATALOG): Recipe[] {
  return entries.map((entry) => ({
    id: entry.slug,
    name: entry.name,
    tag: entry.tag,
    description: entry.description,
    servings: entry.servings,
    minutes: entry.minutes,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    ingredients: entry.ingredients,
    steps: entry.steps,
    isMaster: true,
    createdAt: now,
  }));
}
