export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

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
  'recipeMasterEdit',
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  photoUrl: string | null;
  householdSize: number;
  dietaryNotes: string;
  createdAt: string;
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
  location: string;
  photoUri: string | null;
  expiresOn: string | null;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
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
  ingredients: RecipeIngredient[];
  steps: string[];
  isMaster: boolean;
  createdAt: string;
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
  name: 'index' | 'pantry' | 'recipes' | 'grocery' | 'admin';
  title: string;
  href: string;
  icon: string;
  iconActive: string;
}

export interface ThemeTokens {
  cream: string;
  paper: string;
  sand: string;
  ink: string;
  muted: string;
  border: string;
  slate: string;
  slateMuted: string;
  emerald: string;
  emeraldDark: string;
  emeraldLight: string;
  emeraldAccent: string;
  onEmerald: string;
  card: string;
  danger: string;
}
