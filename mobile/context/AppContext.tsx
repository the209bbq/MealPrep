import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  APP_NAME,
  DEMO_USERS,
  FEATURE_FLAG_DEFAULTS,
  isDemoMode,
} from '../config/appConfig';
import { DEFAULT_FEATURE_FLAGS, MOCK_PANTRY, MOCK_RECIPES, profileForRole } from '../data/mockData';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import { readJson, writeJson } from '../lib/storage';
import { getSupabase } from '../lib/supabase';
import {
  fetchLiveBundle,
  deleteGroceryItems,
  insertGroceryItem,
  insertPantryItem,
  replaceGroceryList,
  updateGroceryChecked,
  updateMasterRecipe,
  upsertFeatureFlag,
} from '../lib/supabaseData';
import type {
  FeatureFlags,
  GroceryListItem,
  MealPrepSummary,
  PantryItem,
  PantryCategory,
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
  selectedRecipeIds: string[];
  servingOverrides: Record<string, number>;
  featureFlags: FeatureFlags;
  maintenanceActive: boolean;
  summary: MealPrepSummary;
  analytics: UserAnalytics;
  toggleRecipeSelection: (recipeId: string) => void;
  setServingOverride: (recipeId: string, servings: number) => void;
  toggleGroceryItem: (id: string) => void;
  addManualGroceryItem: (input: { name: string; quantity: number; unit: string; category: PantryCategory }) => void;
  clearCheckedGroceryItems: () => void;
  seedPantry: () => void;
  updateRecipe: (recipe: Recipe) => void;
  addPantryFromScan: (name: string, photoUri: string | null) => void;
  setFeatureFlag: (key: keyof FeatureFlags, value: boolean) => void;
  refreshGrocery: () => void;
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
  const [liveAnalytics, setLiveAnalytics] = useState<UserAnalytics | null>(null);

  const profile = demoMode ? profileForRole(role) : liveProfile ?? GUEST_PROFILE;
  const isAdmin = profile.role === 'admin';
  const maintenanceActive = featureFlags.maintenanceMode && !isAdmin;
  const userId = session?.user.id ?? null;

  const loadLiveData = useCallback(async () => {
    if (!supabase || !userId) return;
    const bundle = await fetchLiveBundle(supabase, userId);
    if (bundle.profile) setLiveProfile(bundle.profile);
    setPantry(bundle.pantry);
    setRecipes(bundle.recipes.length > 0 ? bundle.recipes : []);
    setGrocery(bundle.grocery);
    setFeatureFlags(bundle.featureFlags);
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
      const next = buildGroceryList(recipes, selectedRecipeIds, pantry, servingOverrides, prev);
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
  }, [demoMode, featureFlags.grocerySync, pantry, recipes, selectedRecipeIds, servingOverrides, supabase, userId]);

  useEffect(() => {
    refreshGrocery();
  }, [pantry, recipes, selectedRecipeIds, servingOverrides, featureFlags.grocerySync, refreshGrocery]);

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

  const toggleRecipeSelection = useCallback((recipeId: string) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId],
    );
  }, []);

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

  const addPantryFromScan = useCallback(
    (name: string, photoUri: string | null) => {
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
      selectedRecipeIds,
      servingOverrides,
      featureFlags,
      maintenanceActive,
      summary,
      analytics,
      toggleRecipeSelection,
      setServingOverride,
      toggleGroceryItem,
      addManualGroceryItem,
      clearCheckedGroceryItems,
      seedPantry,
      updateRecipe,
      addPantryFromScan,
      setFeatureFlag,
      refreshGrocery,
    }),
    [
      addPantryFromScan,
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
      selectedRecipeIds,
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
