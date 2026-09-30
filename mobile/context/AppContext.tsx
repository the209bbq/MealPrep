import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  APP_NAME,
  DEMO_USERS,
  FEATURE_FLAG_DEFAULTS,
  isDemoMode,
} from '../config/appConfig';
import { DEFAULT_PANTRY_STORAGE_LOCATION, normalizePantryItemList } from '../config/pantryStorage';
import { DEFAULT_FEATURE_FLAGS, MOCK_PANTRY, MOCK_RECIPES, profileForRole } from '../data/mockData';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import { addMissingRecipeIngredientsToGrocery as mergeMissingIntoGrocery } from '../lib/recipeMatch/groceryFromMissing';
import {
  buildPantryMatchIndex,
  topPantryRecipeRecommendations,
  type PantryMatchIndex,
} from '../lib/recipeMatch';
import { reviewItemsToPantryItems } from '../lib/pantryVision/reviewItems';
import type { PantryScanReviewItem } from '../lib/pantryVision/types';
import { readJson, writeJson } from '../lib/storage';
import { getSupabase } from '../lib/supabase';
import { recipeApiToAppRecipe } from '../lib/recipeDiscovery/mapToAppRecipe';
import { isRecipeApiInLibrary, recipeApiMasterSlug, recipeApiPersonalSlug } from '../lib/recipeDiscovery/slugs';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';
import { activeMealPlanRecipeIds, isRecipeOnMealPlan } from '../lib/mealPlan/resolve';
import {
  fetchLiveBundle,
  deleteGroceryItems,
  deleteMealPlanItem,
  insertGroceryItem,
  insertMealPlanItem,
  insertPantryItem,
  insertPantryItems,
  deleteAllPantryItems,
  deletePantryItemsByIds,
  replaceGroceryList,
  updateGroceryChecked,
  updateMasterRecipe,
  updateMealPlanItem,
  updatePantryItem,
  upsertFeatureFlag,
  upsertImportedRecipe,
} from '../lib/supabaseData';
import type {
  FeatureFlags,
  GroceryListItem,
  MealPlanItem,
  MealPrepSummary,
  PantryItem,
  PantryCategory,
  PantryStorageLocation,
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
  mealPlan: 'mealprep.mealPlan',
  servingOverrides: 'mealprep.servingOverrides',
  flags: 'mealprep.featureFlags',
};

const GUEST_PROFILE: UserProfile = {
  id: '',
  email: '',
  name: 'Guest',
  role: 'member',
  photoUrl: null,
  householdSize: 2,
  dietaryNotes: '',
  createdAt: new Date(0).toISOString(),
};

interface AppContextValue {
  appName: string;
  demoMode: boolean;
  authReady: boolean;
  authError: string | null;
  session: Session | null;
  profile: UserProfile;
  isAdmin: boolean;
  setDemoRole: (role: UserRole) => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  pantry: PantryItem[];
  recipes: Recipe[];
  grocery: GroceryListItem[];
  mealPlan: MealPlanItem[];
  /** Recipe ids driving grocery sync (active meal plan entries). */
  plannedRecipeIds: string[];
  servingOverrides: Record<string, number>;
  featureFlags: FeatureFlags;
  maintenanceActive: boolean;
  summary: MealPrepSummary;
  analytics: UserAnalytics;
  toggleMealPlanKitchenRecipe: (recipeId: string) => Promise<void>;
  toggleMealPlanDiscoveryRecipe: (item: RecipeDiscoveryListItem) => Promise<void>;
  removeMealPlanItem: (id: string) => Promise<void>;
  setMealPlanItemMade: (id: string, made: boolean) => Promise<void>;
  isOnMealPlan: (options: { recipeSlug?: string; recipeApiId?: number }) => boolean;
  addMissingForPlannedMealsToGrocery: () => void;
  setServingOverride: (recipeId: string, servings: number) => void;
  toggleGroceryItem: (id: string) => void;
  addManualGroceryItem: (input: { name: string; quantity: number; unit: string; category: PantryCategory }) => void;
  clearCheckedGroceryItems: () => void;
  seedPantry: () => void;
  updateRecipe: (recipe: Recipe) => void;
  importDiscoveredRecipe: (
    recipe: Recipe,
    options: { asMaster: boolean; recipeApiId: number },
  ) => Promise<Recipe>;
  addPantryFromScan: (name: string, photoUri: string | null) => void;
  addManualPantryItem: (input: {
    name: string;
    quantity: number;
    unit: string;
    category: PantryCategory;
    location: PantryStorageLocation;
  }) => Promise<void>;
  updatePantryItemEntry: (item: PantryItem) => Promise<void>;
  deletePantryItemEntry: (id: string) => Promise<void>;
  clearPantryLocation: (location: PantryStorageLocation) => Promise<void>;
  clearAllPantry: () => Promise<void>;
  savePantryScanReview: (items: PantryScanReviewItem[]) => Promise<void>;
  setFeatureFlag: (key: keyof FeatureFlags, value: boolean) => void;
  refreshGrocery: () => void;
  pantryRecipeMatches: PantryMatchIndex;
  pantryRecipeRecommendations: ReturnType<typeof topPantryRecipeRecommendations>;
  addMissingRecipeIngredientsToGrocery: (recipeId: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  const supabase = demoMode ? null : getSupabase();

  const [authReady, setAuthReady] = useState(demoMode);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [liveProfile, setLiveProfile] = useState<UserProfile | null>(null);

  const [role, setRole] = useState<UserRole>(() => readJson(STORAGE_KEYS.role, 'admin'));
  const [pantry, setPantry] = useState<PantryItem[]>(() =>
    normalizePantryItemList(readJson(STORAGE_KEYS.pantry, MOCK_PANTRY)),
  );
  const [recipes, setRecipes] = useState<Recipe[]>(() => readJson(STORAGE_KEYS.recipes, MOCK_RECIPES));
  const [grocery, setGrocery] = useState<GroceryListItem[]>(() => readJson(STORAGE_KEYS.grocery, []));
  const [mealPlan, setMealPlan] = useState<MealPlanItem[]>(() => {
    const stored = readJson<MealPlanItem[] | null>(STORAGE_KEYS.mealPlan, null);
    if (stored && stored.length > 0) return stored;
    const legacyIds = readJson<string[]>(STORAGE_KEYS.selectedRecipes, ['lemon-chicken', 'pulled-pork']);
    const now = new Date().toISOString();
    return legacyIds.map((slug) => {
      const recipe = MOCK_RECIPES.find((r) => r.id === slug);
      return {
      id: `demo-plan-${slug}`,
      recipeSlug: slug,
      recipeApiId: null,
      title: recipe?.name ?? slug,
      imageUrl: null,
      made: false,
      addedAt: now,
    }));
  });
  const [servingOverrides, setServingOverrides] = useState<Record<string, number>>(() =>
    readJson(STORAGE_KEYS.servingOverrides, {}),
  );
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(() =>
    readJson(STORAGE_KEYS.flags, DEFAULT_FEATURE_FLAGS),
  );
  const [liveAnalytics, setLiveAnalytics] = useState<UserAnalytics | null>(null);

  const profile = demoMode ? profileForRole(role) : liveProfile ?? GUEST_PROFILE;
  const isAdmin = profile.role === 'admin';
  const maintenanceActive = featureFlags.maintenanceMode && !isAdmin;
  const userId = session?.user.id ?? null;
  const ownerId = profile.id || 'demo-user';

  const plannedRecipeIds = useMemo(
    () => activeMealPlanRecipeIds(mealPlan, recipes, ownerId),
    [mealPlan, ownerId, recipes],
  );

  const loadLiveData = useCallback(async () => {
    if (!supabase || !userId) return;
    const bundle = await fetchLiveBundle(supabase, userId);
    if (bundle.profile) setLiveProfile(bundle.profile);
    setPantry(normalizePantryItemList(bundle.pantry));
    setRecipes(bundle.recipes.length > 0 ? bundle.recipes : []);
    setGrocery(bundle.grocery);
    setFeatureFlags(bundle.featureFlags);
    setMealPlan(bundle.mealPlan ?? []);
    setLiveAnalytics(bundle.analytics);
  }, [supabase, userId]);

  useEffect(() => {
    if (demoMode || !supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [demoMode, supabase]);

  useEffect(() => {
    if (demoMode || !userId) {
      if (!demoMode && !userId) {
        setLiveProfile(null);
        setLiveAnalytics(null);
      }
      return;
    }
    void loadLiveData().catch((error: unknown) => {
      setAuthError(error instanceof Error ? error.message : 'Failed to load kitchen data');
    });
  }, [demoMode, userId, loadLiveData]);

  const refreshGrocery = useCallback(() => {
    if (!featureFlags.grocerySync) return;
    setGrocery((prev) => {
      const next = buildGroceryList(recipes, plannedRecipeIds, pantry, servingOverrides, prev);
      if (demoMode) {
        writeJson(STORAGE_KEYS.grocery, next);
        return next;
      }
      if (supabase && userId) {
        void replaceGroceryList(supabase, userId, next)
          .then((persisted) => setGrocery(persisted))
          .catch((error: unknown) => {
            setAuthError(error instanceof Error ? error.message : 'Failed to save grocery list');
          });
        return next;
      }
      return next;
    });
  }, [demoMode, featureFlags.grocerySync, pantry, plannedRecipeIds, recipes, servingOverrides, supabase, userId]);

  useEffect(() => {
    refreshGrocery();
  }, [pantry, recipes, plannedRecipeIds, servingOverrides, featureFlags.grocerySync, refreshGrocery]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.role, role);
  }, [demoMode, role]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.pantry, pantry);
  }, [demoMode, pantry]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.recipes, recipes);
  }, [demoMode, recipes]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.flags, featureFlags);
  }, [demoMode, featureFlags]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.mealPlan, mealPlan);
  }, [demoMode, mealPlan]);

  const summary = useMemo<MealPrepSummary>(() => {
    const activePlan = mealPlan.filter((m) => !m.made);
    const selected = recipes.filter((r) => plannedRecipeIds.includes(r.id));
    const proteinGrams = selected.reduce((sum, r) => sum + r.protein, 0);
    return {
      date: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      mealsPlanned: activePlan.length,
      pantryItems: pantry.length,
      groceryRemaining: grocery.filter((g) => !g.checked).length,
      proteinGrams,
    };
  }, [grocery, mealPlan, pantry.length, plannedRecipeIds, recipes]);

  const analytics = useMemo<UserAnalytics>(() => {
    if (!demoMode && liveAnalytics) return liveAnalytics;
    return {
      userCount: Object.keys(DEMO_USERS).length,
      adminCount: 1,
      memberCount: 1,
      pantryItems: pantry.length,
      recipes: recipes.length,
      groceryOpen: grocery.filter((g) => !g.checked).length,
      lastActiveAt: new Date().toISOString(),
    };
  }, [demoMode, grocery, liveAnalytics, pantry.length, recipes.length]);

  const pantryRecipeMatches = useMemo(
    () => buildPantryMatchIndex(recipes, pantry),
    [pantry, recipes],
  );

  const pantryRecipeRecommendations = useMemo(
    () => topPantryRecipeRecommendations(recipes, pantry, 3),
    [pantry, recipes],
  );

  const setDemoRole = useCallback((next: UserRole) => {
    setRole(next);
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return;
      setAuthError(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string, name: string) => {
      if (!supabase) return;
      setAuthError(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/admin'),
          data: { name: name.trim() || email.split('@')[0] },
        },
      });
      if (error) setAuthError(error.message);
    },
    [supabase],
  );

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      if (!supabase) return;
      setAuthError(null);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getAuthRedirectUrl('/admin') },
      });
      if (error) setAuthError(error.message);
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setAuthError(null);
    await supabase.auth.signOut();
    setLiveProfile(null);
    setLiveAnalytics(null);
  }, [supabase]);

  const isOnMealPlan = useCallback(
    (options: { recipeSlug?: string; recipeApiId?: number }) =>
      Boolean(isRecipeOnMealPlan(mealPlan, options)),
    [mealPlan],
  );

  const removeMealPlanItem = useCallback(
    async (id: string) => {
      setMealPlan((prev) => prev.filter((item) => item.id !== id));
      if (!demoMode && supabase && userId) {
        await deleteMealPlanItem(supabase, userId, id).catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to remove meal plan item');
        });
      }
    },
    [demoMode, supabase, userId],
  );

  const setMealPlanItemMade = useCallback(
    async (id: string, made: boolean) => {
      setMealPlan((prev) => prev.map((item) => (item.id === id ? { ...item, made } : item)));
      if (!demoMode && supabase && userId) {
        await updateMealPlanItem(supabase, userId, id, { made }).catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to update meal plan');
        });
      }
    },
    [demoMode, supabase, userId],
  );

  const addMealPlanEntry = useCallback(
    async (entry: Omit<MealPlanItem, 'id'>) => {
      if (demoMode) {
        const id = `demo-plan-${Date.now()}`;
        setMealPlan((prev) => [{ ...entry, id }, ...prev]);
        return;
      }
      if (!supabase || !userId) throw new Error('Sign in to save your meal plan.');
      const saved = await insertMealPlanItem(supabase, userId, entry);
      setMealPlan((prev) => [saved, ...prev]);
    },
    [demoMode, supabase, userId],
  );

  const toggleMealPlanKitchenRecipe = useCallback(
    async (recipeId: string) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;
      const existing = isRecipeOnMealPlan(mealPlan, { recipeSlug: recipeId });
      if (existing) {
        await removeMealPlanItem(existing.id);
        return;
      }
      await addMealPlanEntry({
        recipeSlug: recipeId,
        recipeApiId: null,
        title: recipe.name,
        imageUrl: null,
        made: false,
        addedAt: new Date().toISOString(),
      });
    },
    [addMealPlanEntry, mealPlan, recipes, removeMealPlanItem],
  );

  const setServingOverride = useCallback((recipeId: string, servings: number) => {
    setServingOverrides((prev) => ({ ...prev, [recipeId]: servings }));
  }, []);

  const toggleGroceryItem = useCallback(
    (id: string) => {
      setGrocery((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
        if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
        if (supabase && userId) {
          const changed = next.find((item) => item.id === id);
          if (changed && !changed.id.startsWith('groc-')) {
            void updateGroceryChecked(supabase, changed.id, changed.checked).catch((error: unknown) => {
              setAuthError(error instanceof Error ? error.message : 'Failed to update grocery item');
            });
          }
        }
        return next;
      });
    },
    [demoMode, supabase, userId],
  );

  const addManualGroceryItem = useCallback(
    (input: { name: string; quantity: number; unit: string; category: PantryCategory }) => {
      const trimmed = input.name.trim();
      if (!trimmed) return;
      const item = createManualGroceryItem({ ...input, name: trimmed });
      setGrocery((prev) => {
        const next = [...prev, item];
        if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
        if (supabase && userId) {
          void insertGroceryItem(supabase, userId, item)
            .then((saved) => setGrocery((current) => [...current.filter((g) => g.id !== item.id), saved]))
            .catch((error: unknown) => {
              setAuthError(error instanceof Error ? error.message : 'Failed to add grocery item');
            });
        }
        return next;
      });
    },
    [demoMode, supabase, userId],
  );

  const clearCheckedGroceryItems = useCallback(() => {
    setGrocery((prev) => {
      const removedIds = prev.filter((item) => item.checked).map((item) => item.id);
      const next = prev.filter((item) => !item.checked);
      if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
      if (supabase && userId && removedIds.length > 0) {
        void deleteGroceryItems(supabase, userId, removedIds)
          .then(() => setGrocery(next))
          .catch((error: unknown) => {
            setAuthError(error instanceof Error ? error.message : 'Failed to clear checked items');
          });
      }
      return next;
    });
  }, [demoMode, supabase, userId]);

  const seedPantry = useCallback(() => {
    if (demoMode) {
      setPantry(MOCK_PANTRY);
      return;
    }
    if (!supabase || !userId) return;
    void (async () => {
      const inserted: PantryItem[] = [];
      for (const item of MOCK_PANTRY) {
        inserted.push(await insertPantryItem(supabase, userId, { ...item, id: `seed-${item.id}` }));
      }
      setPantry((prev) => [...inserted, ...prev]);
    })().catch((error: unknown) => {
      setAuthError(error instanceof Error ? error.message : 'Failed to seed pantry');
    });
  }, [demoMode, supabase, userId]);

  const updateRecipe = useCallback(
    (recipe: Recipe) => {
      setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? recipe : r)));
      if (!demoMode && supabase && isAdmin) {
        void updateMasterRecipe(supabase, recipe).catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to update recipe');
        });
      }
    },
    [demoMode, isAdmin, supabase],
  );

  const importDiscoveredRecipe = useCallback(
    async (recipe: Recipe, options: { asMaster: boolean; recipeApiId: number }): Promise<Recipe> => {
      if (options.asMaster && !isAdmin) {
        throw new Error('Only admins can add recipes to the shared kitchen catalog.');
      }
      if (demoMode) {
        let saved = { ...recipe, isMaster: options.asMaster };
        setRecipes((prev) => {
          const exists = prev.some((r) => r.id === recipe.id);
          const next = exists
            ? prev.map((r) => (r.id === recipe.id ? saved : r))
            : [saved, ...prev];
          writeJson(STORAGE_KEYS.recipes, next);
          return next;
        });
        return saved;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to save recipes.');
      }
      const saved = await upsertImportedRecipe(supabase, userId, recipe, options);
      setRecipes((prev) => {
        const exists = prev.some((r) => r.id === saved.id);
        return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev];
      });
      return saved;
    },
    [demoMode, isAdmin, supabase, userId],
  );

  const toggleMealPlanDiscoveryRecipe = useCallback(
    async (item: RecipeDiscoveryListItem) => {
      const existing = isRecipeOnMealPlan(mealPlan, { recipeApiId: item.id });
      if (existing) {
        await removeMealPlanItem(existing.id);
        return;
      }

      let slug = recipeApiMasterSlug(item.id);
      if (recipes.some((r) => r.id === slug)) {
        // shared catalog
      } else if (isRecipeApiInLibrary(recipes, item.id, ownerId)) {
        slug = recipes.find((r) => r.id === slug || r.id === recipeApiPersonalSlug(item.id, ownerId))?.id ?? slug;
      } else {
        const mapped = recipeApiToAppRecipe(item, { asMaster: isAdmin, userId: ownerId });
        const saved = await importDiscoveredRecipe(mapped, { asMaster: isAdmin, recipeApiId: item.id });
        slug = saved.id;
      }

      await addMealPlanEntry({
        recipeSlug: slug,
        recipeApiId: item.id,
        title: item.name,
        imageUrl: null,
        made: false,
        addedAt: new Date().toISOString(),
      });
    },
    [
      addMealPlanEntry,
      importDiscoveredRecipe,
      isAdmin,
      mealPlan,
      ownerId,
      recipes,
      removeMealPlanItem,
    ],
  );

  const addMissingForPlannedMealsToGrocery = useCallback(() => {
    setGrocery((prev) => {
      let next = prev;
      for (const recipeId of plannedRecipeIds) {
        const match = pantryRecipeMatches.byRecipeId.get(recipeId);
        if (!match || match.missing.length === 0) continue;
        next = mergeMissingIntoGrocery({
          missing: match.missing,
          recipeId,
          pantry,
          previous: next,
        });
      }
      if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
      if (!demoMode && supabase && userId) {
        void replaceGroceryList(supabase, userId, next)
          .then((persisted) => setGrocery(persisted))
          .catch((error: unknown) => {
            setAuthError(error instanceof Error ? error.message : 'Failed to save grocery list');
          });
      }
      return next;
    });
  }, [demoMode, pantry, pantryRecipeMatches.byRecipeId, plannedRecipeIds, supabase, userId]);

  const addPantryFromScan = useCallback(
    (name: string, photoUri: string | null) => {
      const item: PantryItem = {
        id: `scan-${Date.now()}`,
        ingredientId: `scan-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        category: 'produce',
        quantity: 1,
        unit: 'each',
        location: DEFAULT_PANTRY_STORAGE_LOCATION,
        photoUri,
        expiresOn: null,
        updatedAt: new Date().toISOString(),
      };
      if (demoMode) {
        setPantry((prev) => [item, ...prev]);
        return;
      }
      if (!supabase || !userId) return;
      void insertPantryItem(supabase, userId, item)
        .then((saved) => setPantry((prev) => [saved, ...prev]))
        .catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to add pantry item');
        });
    },
    [demoMode, supabase, userId],
  );

  const addManualPantryItem = useCallback(
    async (input: {
      name: string;
      quantity: number;
      unit: string;
      category: PantryCategory;
      location: PantryStorageLocation;
    }) => {
      const slug = input.name.toLowerCase().replace(/\s+/g, '-');
      const item: PantryItem = {
        id: `manual-${Date.now()}`,
        ingredientId: `manual-${slug}-${Date.now()}`,
        name: input.name.trim(),
        category: input.category,
        quantity: input.quantity,
        unit: input.unit.trim() || 'each',
        location: input.location,
        photoUri: null,
        expiresOn: null,
        updatedAt: new Date().toISOString(),
      };
      if (demoMode) {
        setPantry((prev) => [item, ...prev]);
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to add pantry items.');
      }
      const saved = await insertPantryItem(supabase, userId, item);
      setPantry((prev) => [saved, ...prev]);
    },
    [demoMode, supabase, userId],
  );

  const updatePantryItemEntry = useCallback(
    async (item: PantryItem) => {
      if (demoMode) {
        setPantry((prev) => prev.map((row) => (row.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : row)));
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to update pantry items.');
      }
      const saved = await updatePantryItem(supabase, userId, item);
      setPantry((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    },
    [demoMode, supabase, userId],
  );

  const deletePantryItemEntry = useCallback(
    async (id: string) => {
      if (demoMode) {
        setPantry((prev) => prev.filter((row) => row.id !== id));
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to update pantry.');
      }
      await deletePantryItemsByIds(supabase, userId, [id]);
      setPantry((prev) => prev.filter((row) => row.id !== id));
    },
    [demoMode, supabase, userId],
  );

  const clearPantryLocation = useCallback(
    async (location: PantryStorageLocation) => {
      const ids = pantry.filter((item) => item.location === location).map((item) => item.id);
      if (ids.length === 0) return;
      if (demoMode) {
        setPantry((prev) => prev.filter((item) => item.location !== location));
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to update pantry.');
      }
      await deletePantryItemsByIds(supabase, userId, ids);
      setPantry((prev) => prev.filter((item) => item.location !== location));
    },
    [demoMode, pantry, supabase, userId],
  );

  const clearAllPantry = useCallback(async () => {
    if (pantry.length === 0) return;
    if (demoMode) {
      setPantry([]);
      return;
    }
    if (!supabase || !userId) {
      throw new Error('Sign in to update pantry.');
    }
    await deleteAllPantryItems(supabase, userId);
    setPantry([]);
  }, [demoMode, pantry.length, supabase, userId]);

  const savePantryScanReview = useCallback(
    async (items: PantryScanReviewItem[]) => {
      const toSave = reviewItemsToPantryItems(items);
      if (toSave.length === 0) return;

      if (demoMode) {
        setPantry((prev) => [...toSave, ...prev]);
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to save pantry items.');
      }

      const saved = await insertPantryItems(supabase, userId, toSave);
      setPantry((prev) => [...saved, ...prev]);
    },
    [demoMode, supabase, userId],
  );

  const setFeatureFlag = useCallback(
    (key: keyof FeatureFlags, value: boolean) => {
      setFeatureFlags((prev) => ({ ...prev, [key]: value }));
      if (!demoMode && supabase && isAdmin) {
        void upsertFeatureFlag(supabase, key, value).catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to update feature flag');
        });
      }
    },
    [demoMode, isAdmin, supabase],
  );

  const addMissingRecipeIngredientsToGrocery = useCallback(
    (recipeId: string) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      const match = pantryRecipeMatches.byRecipeId.get(recipeId);
      if (!recipe || !match || match.missing.length === 0) return;

      setGrocery((prev) => {
        const next = mergeMissingIntoGrocery({
          missing: match.missing,
          recipeId,
          pantry,
          previous: prev,
        });
        if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
        if (supabase && userId) {
          void replaceGroceryList(supabase, userId, next)
            .then((persisted) => setGrocery(persisted))
            .catch((error: unknown) => {
              setAuthError(error instanceof Error ? error.message : 'Failed to save grocery list');
            });
        }
        return next;
      });
    },
    [demoMode, pantry, pantryRecipeMatches.byRecipeId, recipes, supabase, userId],
  );

  const value = useMemo(
    () => ({
      appName: APP_NAME,
      demoMode,
      authReady,
      authError,
      session,
      profile,
      isAdmin,
      setDemoRole,
      signInWithPassword,
      signUpWithPassword,
      signInWithMagicLink,
      signOut,
      pantry,
      recipes,
      grocery,
      mealPlan,
      plannedRecipeIds,
      servingOverrides,
      featureFlags,
      maintenanceActive,
      summary,
      analytics,
      toggleMealPlanKitchenRecipe,
      toggleMealPlanDiscoveryRecipe,
      removeMealPlanItem,
      setMealPlanItemMade,
      isOnMealPlan,
      addMissingForPlannedMealsToGrocery,
      setServingOverride,
      toggleGroceryItem,
      addManualGroceryItem,
      clearCheckedGroceryItems,
      seedPantry,
      updateRecipe,
      importDiscoveredRecipe,
      addPantryFromScan,
      addManualPantryItem,
      updatePantryItemEntry,
      deletePantryItemEntry,
      clearPantryLocation,
      clearAllPantry,
      savePantryScanReview,
      setFeatureFlag,
      refreshGrocery,
      pantryRecipeMatches,
      pantryRecipeRecommendations,
      addMissingRecipeIngredientsToGrocery,
    }),
    [
      addPantryFromScan,
      addManualPantryItem,
      updatePantryItemEntry,
      deletePantryItemEntry,
      clearPantryLocation,
      clearAllPantry,
      savePantryScanReview,
      analytics,
      authError,
      authReady,
      demoMode,
      featureFlags,
      grocery,
      isAdmin,
      maintenanceActive,
      pantry,
      profile,
      recipes,
      refreshGrocery,
      mealPlan,
      plannedRecipeIds,
      servingOverrides,
      session,
      seedPantry,
      setDemoRole,
      setFeatureFlag,
      setServingOverride,
      signInWithMagicLink,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      summary,
      toggleGroceryItem,
      addManualGroceryItem,
      clearCheckedGroceryItems,
      toggleMealPlanKitchenRecipe,
      toggleMealPlanDiscoveryRecipe,
      removeMealPlanItem,
      setMealPlanItemMade,
      isOnMealPlan,
      addMissingForPlannedMealsToGrocery,
      updateRecipe,
      importDiscoveredRecipe,
      pantryRecipeMatches,
      pantryRecipeRecommendations,
      addMissingRecipeIngredientsToGrocery,
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
