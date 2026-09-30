import type { PantryItem, Recipe, UserProfile } from '../types/mealprep';
import { DEMO_USERS, FEATURE_FLAG_DEFAULTS } from '../config/appConfig';

const now = new Date().toISOString();

export const MOCK_RECIPES: Recipe[] = [
  {
    id: 'brisket',
    name: 'Smoked Lean Brisket & Sweet Potato',
    tag: 'Signature Smoked',
    description: 'Slow-smoked brisket with roasted sweet potato and green beans.',
    servings: 4,
    minutes: 45,
    calories: 520,
    protein: 45,
    isMaster: true,
    createdAt: now,
    steps: ['Prep vegetables', 'Reheat brisket', 'Plate and serve'],
    ingredients: [
      { ingredientId: 'brisket-meat', name: 'Smoked brisket', quantity: 24, unit: 'oz' },
      { ingredientId: 'sweet-potato', name: 'Sweet potato', quantity: 2, unit: 'each' },
      { ingredientId: 'green-beans', name: 'Green beans', quantity: 12, unit: 'oz' },
    ],
  },
  {
    id: 'lemon-chicken',
    name: 'Grilled Lemon Herb Chicken',
    tag: 'Lean & Clean',
    description: 'Chicken over jasmine rice with garlic broccoli.',
    servings: 4,
    minutes: 35,
    calories: 480,
    protein: 42,
    isMaster: true,
    createdAt: now,
    steps: ['Grill chicken', 'Steam rice', 'Sauté broccoli'],
    ingredients: [
      { ingredientId: 'chicken-breast', name: 'Chicken breast', quantity: 24, unit: 'oz' },
      { ingredientId: 'jasmine-rice', name: 'Jasmine rice', quantity: 2, unit: 'cups' },
      { ingredientId: 'broccoli', name: 'Broccoli', quantity: 16, unit: 'oz' },
    ],
  },
  {
    id: 'pulled-pork',
    name: 'Pulled Pork Bowl',
    tag: 'Low Carb',
    description: 'Pulled pork over cauliflower rice with cilantro-lime slaw.',
    servings: 4,
    minutes: 30,
    calories: 440,
    protein: 38,
    isMaster: true,
    createdAt: now,
    steps: ['Warm pork', 'Prepare slaw', 'Assemble bowls'],
    ingredients: [
      { ingredientId: 'pulled-pork', name: 'Pulled pork', quantity: 20, unit: 'oz' },
      { ingredientId: 'cauliflower-rice', name: 'Cauliflower rice', quantity: 4, unit: 'cups' },
      { ingredientId: 'lime', name: 'Limes', quantity: 2, unit: 'each' },
    ],
  },
];

export const MOCK_PANTRY: PantryItem[] = [
  {
    id: 'pantry-1',
    ingredientId: 'jasmine-rice',
    name: 'Jasmine rice',
    category: 'dry_goods',
    quantity: 4,
    unit: 'cups',
    location: 'Pantry shelf',
    photoUri: null,
    expiresOn: null,
    updatedAt: now,
  },
  {
    id: 'pantry-2',
    ingredientId: 'paprika',
    name: 'Smoked paprika',
    category: 'spices',
    quantity: 3,
    unit: 'oz',
    location: 'Spice rack',
    photoUri: null,
    expiresOn: '2027-01-01',
    updatedAt: now,
  },
  {
    id: 'pantry-3',
    ingredientId: 'chicken-breast',
    name: 'Chicken breast',
    category: 'meats',
    quantity: 8,
    unit: 'oz',
    location: 'Fridge',
    photoUri: null,
    expiresOn: '2026-10-05',
    updatedAt: now,
  },
  {
    id: 'pantry-4',
    ingredientId: 'cast-iron',
    name: 'Cast iron skillet',
    category: 'cookware',
    quantity: 1,
    unit: 'each',
    location: 'Stove',
    photoUri: null,
    expiresOn: null,
    updatedAt: now,
  },
  {
    id: 'pantry-5',
    ingredientId: 'broccoli',
    name: 'Broccoli',
    category: 'produce',
    quantity: 8,
    unit: 'oz',
    location: 'Fridge',
    photoUri: null,
    expiresOn: '2026-10-04',
    updatedAt: now,
  },
];

export function profileForRole(role: 'admin' | 'member'): UserProfile {
  const demo = DEMO_USERS[role];
  return {
    id: demo.id,
    email: demo.email,
    name: demo.name,
    role,
    photoUrl: null,
    householdSize: role === 'admin' ? 4 : 2,
    dietaryNotes: role === 'admin' ? 'High protein, no shellfish' : 'Gluten conscious',
    createdAt: now,
  };
}

export const DEFAULT_FEATURE_FLAGS = FEATURE_FLAG_DEFAULTS;
