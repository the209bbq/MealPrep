import type { PantryItem, UserProfile } from '../types/mealprep';
import { DEMO_USERS, FEATURE_FLAG_DEFAULTS } from '../config/appConfig';
import { catalogToRecipes } from './kitchenCatalog';

export const MOCK_RECIPES = catalogToRecipes();

export const MOCK_PANTRY: PantryItem[] = [
  {
    id: 'pantry-1',
    ingredientId: 'jasmine-rice',
    name: 'Jasmine rice',
    category: 'dry_goods',
    quantity: 4,
    unit: 'cups',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pantry-2',
    ingredientId: 'paprika',
    name: 'Smoked paprika',
    category: 'spices',
    quantity: 3,
    unit: 'oz',
    location: 'spice_rack',
    photoUri: null,
    expiresOn: '2027-01-01',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pantry-3',
    ingredientId: 'chicken-breast',
    name: 'Chicken breast',
    category: 'meats',
    quantity: 8,
    unit: 'oz',
    location: 'fridge',
    photoUri: null,
    expiresOn: '2026-10-05',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pantry-4',
    ingredientId: 'cast-iron',
    name: 'Cast iron skillet',
    category: 'cookware',
    quantity: 1,
    unit: 'each',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pantry-5',
    ingredientId: 'broccoli',
    name: 'Broccoli',
    category: 'produce',
    quantity: 8,
    unit: 'oz',
    location: 'fridge',
    photoUri: null,
    expiresOn: '2026-10-04',
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    preferences: {
      autoAddMissingToGrocery: true,
    },
  };
}

export const DEFAULT_FEATURE_FLAGS = FEATURE_FLAG_DEFAULTS;
