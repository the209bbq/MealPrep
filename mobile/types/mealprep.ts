import type { Href } from 'expo-router';

export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

import type { UserPlan } from '../config/plans';
export type { UserPlan } from '../config/plans';

import type { PantryStorageLocation } from '../config/pantryStorage';
export type { PantryStorageLocation } from '../config/pantryStorage';

export const PANTRY_CATEGORIES = [
  'spices',
  'meats',
  'produce',
  'dairy',
  'dry_goods',
  'cookware',
  'frozen',
  'condiments',
] as const;
export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];

export const FEATURE_FLAG_KEYS = [
  'photoScan',
  'batchCalculator',
  'grocerySync',
  'smartShop',
  'maintenanceMode',
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export interface UserPreferences {
  /** When true, adding a recipe to Meals to make auto-adds missing ingredients to the grocery list. */
  autoAddMissingToGrocery: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: UserPlan;
  photoUrl: string | null;
  householdSize: number;
  dietaryNotes: string;
  homeZip?: string;
  homeLat?: number;
  homeLng?: number;
  homeLocationUpdatedAt?: string;
  createdAt: string;
  preferences: UserPreferences;
}

export interface Ingredient {
  id: string;
  name: string;
  defaultUnit: string;
  category: PantryCategory;
}

export interface PantryItem {
  id: string;
  ingredientId: string;
  name: string;
  category: PantryCategory;
  quantity: number;
  unit: string;
  location: PantryStorageLocation;
  photoUri: string | null;
  /** Private storage path for the scan photo used when adding this item (if any). */
  scanPhotoPath?: string | null;
  expiresOn: string | null;
  updatedAt: string;
}

export const NUTRITION_FIELDS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sodium',
  'potassium',
  'calcium',
  'iron',
] as const;

export type NutritionField = (typeof NUTRITION_FIELDS)[number];

export interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
}

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  grams?: number;
  fdcId?: string;
  nutrition?: NutritionValues;
  nutritionSource?: string;
  nutritionCitation?: string;
  nutritionSourcedAt?: string;
}

export interface Recipe {
  id: string;
  name: string;
  tag: string;
  description: string;
  servings: number;
  minutes: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  isMaster: boolean;
  createdAt: string;
  nutritionSource?: string;
  nutritionCitation?: string;
  nutritionSourcedAt?: string;
}

export interface GroceryListItem {
  id: string;
  ingredientId: string;
  name: string;
  category: PantryCategory;
  quantity: number;
  unit: string;
  checked: boolean;
  sourceRecipeIds: string[];
}

/** User meal plan row (kitchen slug and/or RecipeAPI id with display snapshot). */
export interface MealPlanItem {
  id: string;
  recipeSlug: string | null;
  recipeApiId: number | null;
  title: string;
  imageUrl: string | null;
  made: boolean;
  madeAt: string | null;
  addedAt: string;
}

export interface MealPrepSummary {
  date: string;
  mealsPlanned: number;
  pantryItems: number;
  groceryRemaining: number;
  proteinGrams: number;
}

export interface UserAnalytics {
  userCount: number;
  adminCount: number;
  memberCount: number;
  pantryItems: number;
  recipes: number;
  groceryOpen: number;
  lastActiveAt: string;
}

export interface TabConfig {
  name: 'index' | 'pantry' | 'recipes' | 'grocery' | 'profile' | 'admin';
  title: string;
  href: Href;
  icon: string;
  iconActive: string;
  /** Hidden from the tab bar unless the signed-in user is an admin. */
  adminOnly?: boolean;
}

export interface ThemeTokens {
  brandCream: string;
  paper: string;
  sand: string;
  ink: string;
  muted: string;
  border: string;
  card: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryAccent: string;
  onPrimary: string;
  onPrimaryMuted: string;
  slateMuted: string;
  success: string;
  successDark: string;
  successLight: string;
  successAccent: string;
  onSuccess: string;
  danger: string;
}
