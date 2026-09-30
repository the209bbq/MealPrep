import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APP_NAME,
  DEMO_USERS,
  FEATURE_FLAG_DEFAULTS,
  isDemoMode,
} from '../config/appConfig';
import { DEFAULT_FEATURE_FLAGS, MOCK_PANTRY, MOCK_RECIPES, profileForRole } from '../data/mockData';
import { buildGroceryList } from '../lib/grocery';
import { readJson, writeJson } from '../lib/storage';
import type {
  FeatureFlags,
  GroceryListItem,
  MealPrepSummary,
  PantryItem,
  Recipe,
  UserAnalytics,
  UserProfile,
  UserRole,
} from '../types/mealprep';

const STORAGE_KEYS = {
  role: 'mealprep.demoRole',
  pantry: 'mealprep.pantry',
  recipes: 'mealprep.recipes',
  grocery: 'mealprep.grocery',
  selectedRecipes: 'mealprep.selectedRecipes',
  servingOverrides: 'mealprep.servingOverrides',
  flags: 'mealprep.featureFlags',
};

interface AppContextValue {
  appName: string;
  demoMode: boolean;
  profile: UserProfile;
  isAdmin: boolean;
  setDemoRole: (role: UserRole) => void;
  pantry: PantryItem[];
  recipes: Recipe[];
  grocery: GroceryListItem[];
  selectedRecipeIds: string[];
  servingOverrides: Record<string, number>;
  featureFlags: FeatureFlags;
  maintenanceActive: boolean;
  summary: MealPrepSummary;
  analytics: UserAnalytics;
  toggleRecipeSelection: (recipeId: string) => void;
  setServingOverride: (recipeId: string, servings: number) => void;
  toggleGroceryItem: (id: string) => void;
  seedPantry: () => void;
  updateRecipe: (recipe: Recipe) => void;
  addPantryFromScan: (name: string, photoUri: string | null) => void;
  setFeatureFlag: (key: keyof FeatureFlags, value: boolean) => void;
  refreshGrocery: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  const [role, setRole] = useState<UserRole>(() => readJson(STORAGE_KEYS.role, 'admin'));
  const [pantry, setPantry] = useState<PantryItem[]>(() => readJson(STORAGE_KEYS.pantry, MOCK_PANTRY));
  const [recipes, setRecipes] = useState<Recipe[]>(() => readJson(STORAGE_KEYS.recipes, MOCK_RECIPES));
  const [grocery, setGrocery] = useState<GroceryListItem[]>(() => readJson(STORAGE_KEYS.grocery, []));
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>(() =>
    readJson(STORAGE_KEYS.selectedRecipes, ['lemon-chicken', 'pulled-pork']),
  );
  const [servingOverrides, setServingOverrides] = useState<Record<string, number>>(() =>
    readJson(STORAGE_KEYS.servingOverrides, {}),
  );
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(() =>
    readJson(STORAGE_KEYS.flags, DEFAULT_FEATURE_FLAGS),
  );

  const profile = useMemo(() => profileForRole(role), [role]);
  const isAdmin = profile.role === 'admin';
  const maintenanceActive = featureFlags.maintenanceMode && !isAdmin;

  const refreshGrocery = useCallback(() => {
    const next = buildGroceryList(recipes, selectedRecipeIds, pantry, servingOverrides, grocery);
    setGrocery(next);
    writeJson(STORAGE_KEYS.grocery, next);
  }, [grocery, pantry, recipes, selectedRecipeIds, servingOverrides]);

  useEffect(() => {
    refreshGrocery();
  }, [pantry, recipes, selectedRecipeIds, servingOverrides]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.role, role);
  }, [role]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.pantry, pantry);
  }, [pantry]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.recipes, recipes);
  }, [recipes]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.flags, featureFlags);
  }, [featureFlags]);

  const summary = useMemo<MealPrepSummary>(() => {
    const selected = recipes.filter((r) => selectedRecipeIds.includes(r.id));
    const proteinGrams = selected.reduce((sum, r) => sum + r.protein, 0);
    return {
      date: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      mealsPlanned: selected.length,
      pantryItems: pantry.length,
      groceryRemaining: grocery.filter((g) => !g.checked).length,
      proteinGrams,
    };
  }, [grocery, pantry.length, recipes, selectedRecipeIds]);

  const analytics = useMemo<UserAnalytics>(
    () => ({
      userCount: Object.keys(DEMO_USERS).length,
      adminCount: 1,
      memberCount: 1,
      pantryItems: pantry.length,
      recipes: recipes.length,
      groceryOpen: grocery.filter((g) => !g.checked).length,
      lastActiveAt: new Date().toISOString(),
    }),
    [grocery, pantry.length, recipes.length],
  );

  const setDemoRole = useCallback((next: UserRole) => {
    setRole(next);
  }, []);

  const toggleRecipeSelection = useCallback((recipeId: string) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId],
    );
  }, []);

  const setServingOverride = useCallback((recipeId: string, servings: number) => {
    setServingOverrides((prev) => ({ ...prev, [recipeId]: servings }));
  }, []);

  const toggleGroceryItem = useCallback((id: string) => {
    setGrocery((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
      writeJson(STORAGE_KEYS.grocery, next);
      return next;
    });
  }, []);

  const seedPantry = useCallback(() => {
    setPantry(MOCK_PANTRY);
  }, []);

  const updateRecipe = useCallback((recipe: Recipe) => {
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? recipe : r)));
  }, []);

  const addPantryFromScan = useCallback((name: string, photoUri: string | null) => {
    const item: PantryItem = {
      id: `scan-${Date.now()}`,
      ingredientId: `scan-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      category: 'produce',
      quantity: 1,
      unit: 'each',
      location: 'Pending recognition',
      photoUri,
      expiresOn: null,
      updatedAt: new Date().toISOString(),
    };
    setPantry((prev) => [item, ...prev]);
  }, []);

  const setFeatureFlag = useCallback((key: keyof FeatureFlags, value: boolean) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = useMemo(
    () => ({
      appName: APP_NAME,
      demoMode,
      profile,
      isAdmin,
      setDemoRole,
      pantry,
      recipes,
      grocery,
      selectedRecipeIds,
      servingOverrides,
      featureFlags,
      maintenanceActive,
      summary,
      analytics,
      toggleRecipeSelection,
      setServingOverride,
      toggleGroceryItem,
      seedPantry,
      updateRecipe,
      addPantryFromScan,
      setFeatureFlag,
      refreshGrocery,
    }),
    [
      addPantryFromScan,
      analytics,
      demoMode,
      featureFlags,
      grocery,
      isAdmin,
      maintenanceActive,
      pantry,
      profile,
      recipes,
      refreshGrocery,
      selectedRecipeIds,
      servingOverrides,
      seedPantry,
      setDemoRole,
      setFeatureFlag,
      setServingOverride,
      summary,
      toggleGroceryItem,
      toggleRecipeSelection,
      updateRecipe,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function resetFeatureFlags(): FeatureFlags {
  return { ...FEATURE_FLAG_DEFAULTS };
}
