import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useOnboarding } from '../hooks/useOnboarding';
import { useHydrated } from '../hooks/useHydrated';
import type { HandsOnTutorialStepId } from '../lib/onboarding/tutorialProgress';
import type { Session } from '@supabase/supabase-js';
import {
  APP_NAME,
  DEMO_USERS,
  FEATURE_FLAG_DEFAULTS,
  isDemoMode,
  isSupabaseConfigured,
} from '../config/appConfig';
import { GROCERY_COPY } from '../config/grocery';
import { GUEST_OWNER_ID } from '../config/guestMode';
import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  normalizePantryItemList,
  previewResortFromDefaultPantry,
  resortPantryItemIfDefault,
  type PantryResortPreview,
} from '../config/pantryStorage';
import { DEFAULT_FEATURE_FLAGS, MOCK_PANTRY, MOCK_RECIPES, profileForRole } from '../data/mockData';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import {
  addGroceryDismissals,
  clearGroceryDismissals,
  groceryDismissalKey,
  readGroceryDismissals,
} from '../lib/grocery/dismissals';
import { enqueueGroceryPersist } from '../lib/grocery/persistQueue';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import { groceryDismissalKeysForItem } from '../lib/grocery/removals';
import { addMissingRecipeIngredientsToGrocery as mergeMissingIntoGrocery } from '../lib/recipeMatch/groceryFromMissing';
import { router } from 'expo-router';
import { APP_ROUTES } from '../config/appRoutes';
import { MEAL_CALENDAR } from '../config/mealCalendar';
import { USER_PREFERENCE_DEFAULTS } from '../config/userPreferences';
import {
  applyPantryDeductions,
  buildPantryDeductionLines,
  matchedRowsForReview,
  type PantryDeductionLine,
} from '../lib/mealPlan/pantryDeduction';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import {
  buildPantryMatchIndex,
  recipeServingScale,
  scaleRecipeIngredients,
  topPantryRecipeRecommendations,
  withServingScale,
  type PantryMatchIndex,
} from '../lib/recipeMatch';
import { scoreDiscoveryRecipeAgainstPantry } from '../lib/recipeDiscovery/scorePantry';
import { kitchenRecipesForPantryMatch } from '../lib/recipeMatch/kitchenCatalogMerge';
import { fuzzyNameScore, ingredientMatchScore } from '../lib/recipeMatch/ingredientNormalize';
import { reviewItemsToPantryItems } from '../lib/pantryVision/reviewItems';
import { runScanPhotoRetentionCleanupIfDue } from '../lib/scanPhotos/cleanup';
import type { PantryScanReviewItem } from '../lib/pantryVision/types';
import {
  clearGuestKitchenStorage,
  readGuestGrocery,
  readGuestKitchenSnapshot,
  readGuestMealPlan,
  readGuestPantry,
  readGuestRecipes,
  writeGuestGrocery,
  writeGuestMealPlan,
  writeGuestPantry,
  writeGuestRecipes,
} from '../lib/guest/localKitchenStore';
import { localDateString } from '../lib/communityDeals/localDate';
import { mergeGuestKitchenIntoAccount } from '../lib/guest/mergeGuestKitchen';
import { readJson, removeStorageKey, writeJson } from '../lib/storage';
import { clearAddPriceMemory } from '../lib/smartShop/addPriceMemory';
import { getSupabase } from '../lib/supabase';
import { recipeApiToAppRecipe } from '../lib/recipeDiscovery/mapToAppRecipe';
import {
  isRecipeApiInLibrary,
  parseRecipeApiNumericId,
  recipeApiMasterSlug,
  recipeApiPersonalSlug,
  resolveDiscoveryGroceryRecipeId,
} from '../lib/recipeDiscovery/slugs';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';
import {
  mealPlanItemsInWeekWindow,
  recipeIdsForScheduledMeals,
} from '../lib/mealCalendar/weekGroceries';
import { activeMealPlanRecipeIds, isRecipeOnMealPlan, resolveMealPlanRecipeId } from '../lib/mealPlan/resolve';
import {
  applyMealPlanRemoval,
  buildLinkedLeftoverEntry,
  idsRemovedByMealPlanDelete,
} from '../lib/mealCalendar/leftovers';
import { hydrateLocationFromProfile } from '../lib/smartShop/profileLocation';
import {
  fetchLiveBundle,
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
  updateProfilePreferences,
  upsertFeatureFlag,
  upsertImportedRecipe,
} from '../lib/supabaseData';
import type {
  FeatureFlags,
  GroceryListItem,
  MealPlanItem,
  MealPrepSummary,
  MealSlot,
  PantryItem,
  PantryCategory,
  PantryStorageLocation,
  Recipe,
  RecipeIngredient,
  UserAnalytics,
  UserPreferences,
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
  userPreferences: 'mealprep.userPreferences',
};

function initialMealPlan(demoMode: boolean): MealPlanItem[] {
  if (!demoMode) return [];
  const stored = readJson<MealPlanItem[] | null>(STORAGE_KEYS.mealPlan, null);
  if (stored && stored.length > 0) {
    return stored.map((row) => ({
      ...row,
      scheduledOn: row.scheduledOn ?? null,
      mealSlot: row.mealSlot ?? null,
      madeAt: row.madeAt ?? null,
      leftoverOfId: row.leftoverOfId ?? null,
      linkedLeftoverId: row.linkedLeftoverId ?? null,
    }));
  }
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
      madeAt: null,
      addedAt: now,
      scheduledOn: null,
      mealSlot: null,
      leftoverOfId: null,
      linkedLeftoverId: null,
    };
  });
}

const GUEST_PROFILE: UserProfile = {
  id: '',
  email: '',
  name: 'Guest',
  role: 'member',
  plan: 'free',
  photoUrl: null,
  householdSize: 2,
  dietaryNotes: '',
  createdAt: new Date(0).toISOString(),
  preferences: { ...USER_PREFERENCE_DEFAULTS },
};

interface UndoToastState {
  message: string;
  onUndo: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

interface MealMadeUndoState {
  mealPlanItemId: string;
  previousMeal: MealPlanItem;
  pantrySnapshot: PantryItem[];
  deductionLines: PantryDeductionLine[];
}

interface MealMadeReviewState {
  mealPlanItemId: string;
  selectedPantryIds: Set<string>;
}

interface AppContextValue {
  appName: string;
  demoMode: boolean;
  /** Signed-out user on a live Supabase build (local pantry/grocery). */
  isGuest: boolean;
  /** Signed-in user's profile row loaded from Supabase (always true in demo / guest). */
  profileReady: boolean;
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
  openMealMadeReview: (mealPlanItemId: string) => void;
  closeMealMadeReview: () => void;
  toggleMealMadePantryUse: (pantryItemId: string, useFromPantry: boolean) => void;
  confirmMealMade: () => Promise<void>;
  undoLastMealMade: (mealPlanItemId?: string) => Promise<void>;
  mealMadeReview: MealMadeReviewState | null;
  mealMadeReviewTitle: string | null;
  mealMadeReviewRows: ReturnType<typeof matchedRowsForReview>;
  mealMadeBusy: boolean;
  isOnMealPlan: (options: { recipeSlug?: string; recipeApiId?: number }) => boolean;
  scheduleMealFromRecipe: (input: {
    recipeId: string;
    recipeSlug: string | null;
    recipeApiId: number | null;
    title: string;
    imageUrl: string | null;
    scheduledOn: string;
    mealSlot: MealSlot;
    makesLeftovers?: boolean;
  }) => Promise<void>;
  updateMealPlanSchedule: (
    id: string,
    patch: Partial<Pick<MealPlanItem, 'scheduledOn' | 'mealSlot'>>,
  ) => Promise<void>;
  shopForWeekScheduledMeals: () => void;
  addMissingForPlannedMealsToGrocery: () => void;
  userPreferences: UserPreferences;
  setUserPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  undoToast: UndoToastState | null;
  dismissUndoToast: () => void;
  setServingOverride: (recipeId: string, servings: number) => void;
  toggleGroceryItem: (id: string) => void;
  addManualGroceryItem: (input: { name: string; quantity: number; unit: string; category: PantryCategory }) => void;
  clearCheckedGroceryItems: () => void;
  removeGroceryItem: (id: string) => void;
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
  previewPantryResort: () => PantryResortPreview;
  resortPantryItemsInDefaultLocation: () => Promise<PantryResortPreview>;
  savePantryScanReview: (items: PantryScanReviewItem[], scanPhotoPath?: string | null) => Promise<void>;
  setFeatureFlag: (key: keyof FeatureFlags, value: boolean) => void;
  refreshGrocery: () => void;
  pantryRecipeMatches: PantryMatchIndex;
  pantryRecipeRecommendations: ReturnType<typeof topPantryRecipeRecommendations>;
  addMissingRecipeIngredientsToGrocery: (recipeId: string) => void;
  addMissingDiscoveryRecipeIngredientsToGrocery: (item: RecipeDiscoveryListItem) => void;
  onboarding: ReturnType<typeof useOnboarding>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  const supabase = demoMode ? null : getSupabase();
  const hydrated = useHydrated();

  const [authReady, setAuthReady] = useState(demoMode);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [liveProfile, setLiveProfile] = useState<UserProfile | null>(null);

  const [role, setRole] = useState<UserRole>('admin');
  const [pantry, setPantry] = useState<PantryItem[]>(() =>
    demoMode ? normalizePantryItemList(MOCK_PANTRY) : [],
  );
  const [recipes, setRecipes] = useState<Recipe[]>(() => (demoMode ? MOCK_RECIPES : []));
  const [grocery, setGrocery] = useState<GroceryListItem[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlanItem[]>([]);
  const [liveDataLoaded, setLiveDataLoaded] = useState(demoMode);
  const [servingOverrides, setServingOverrides] = useState<Record<string, number>>({});
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(USER_PREFERENCE_DEFAULTS);

  useEffect(() => {
    if (!hydrated) return;
    setUserPreferences(readJson(STORAGE_KEYS.userPreferences, USER_PREFERENCE_DEFAULTS));
    setServingOverrides(readJson(STORAGE_KEYS.servingOverrides, {}));
    if (!demoMode) return;
    setRole(readJson(STORAGE_KEYS.role, 'admin'));
    setPantry(normalizePantryItemList(readJson(STORAGE_KEYS.pantry, MOCK_PANTRY)));
    setRecipes(readJson(STORAGE_KEYS.recipes, MOCK_RECIPES));
    setGrocery(readJson(STORAGE_KEYS.grocery, []));
    setMealPlan(initialMealPlan(true));
    setFeatureFlags(readJson(STORAGE_KEYS.flags, DEFAULT_FEATURE_FLAGS));
  }, [demoMode, hydrated]);
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const [mealMadeReview, setMealMadeReview] = useState<MealMadeReviewState | null>(null);
  const [mealMadeUndo, setMealMadeUndo] = useState<MealMadeUndoState | null>(null);
  const [mealMadeBusy, setMealMadeBusy] = useState(false);
  const [liveAnalytics, setLiveAnalytics] = useState<UserAnalytics | null>(null);

  const profile = useMemo<UserProfile>(() => {
    if (demoMode) {
      return { ...profileForRole(role), preferences: userPreferences };
    }
    if (liveProfile) {
      return { ...liveProfile, preferences: userPreferences };
    }
    return { ...GUEST_PROFILE, preferences: userPreferences };
  }, [demoMode, liveProfile, role, userPreferences]);
  const isAdmin = profile.role === 'admin';
  const maintenanceActive = featureFlags.maintenanceMode && !isAdmin;
  const userId = session?.user.id ?? null;
  const isGuest = !demoMode && !userId;
  const profileReady = demoMode || isGuest || liveDataLoaded;
  const ownerId = userId ?? (demoMode ? profile.id || 'demo-user' : GUEST_OWNER_ID);

  const onboarding = useOnboarding({ session, authReady });
  const notifyTutorialStepCompleteRef = useRef<(stepId: HandsOnTutorialStepId) => void>(() => {});
  notifyTutorialStepCompleteRef.current = onboarding.notifyTutorialStepComplete;

  const plannedRecipeIds = useMemo(
    () => activeMealPlanRecipeIds(mealPlan, recipes, ownerId),
    [mealPlan, ownerId, recipes],
  );

  const loadLiveData = useCallback(async () => {
    if (!supabase || !userId) return;
    setLiveDataLoaded(false);
    const guestKitchen = readGuestKitchenSnapshot();
    const bundle = await fetchLiveBundle(supabase, userId);
    if (bundle.profile) {
      setLiveProfile(bundle.profile);
      setUserPreferences(bundle.profile.preferences);
      hydrateLocationFromProfile(bundle.profile);
    }

    let nextPantry = normalizePantryItemList(bundle.pantry);
    let nextGrocery = bundle.grocery;

    let nextMealPlan = bundle.mealPlan ?? [];
    let nextRecipes = bundle.recipes.length > 0 ? bundle.recipes : [];

    if (
      guestKitchen.pantry.length > 0 ||
      guestKitchen.grocery.length > 0 ||
      guestKitchen.mealPlan.length > 0
    ) {
      const merged = mergeGuestKitchenIntoAccount(
        nextPantry,
        nextGrocery,
        guestKitchen.pantry,
        guestKitchen.grocery,
        nextMealPlan,
        guestKitchen.mealPlan,
      );
      nextPantry = normalizePantryItemList(merged.pantry);
      nextGrocery = merged.grocery;
      nextMealPlan = merged.mealPlan;

      for (const row of merged.pantryUpdates) {
        await updatePantryItem(supabase, userId, row);
      }
      if (merged.pantryInserts.length > 0) {
        const inserted = await insertPantryItems(supabase, userId, merged.pantryInserts);
        const insertIds = new Set(merged.pantryInserts.map((row) => row.id));
        nextPantry = [
          ...inserted,
          ...nextPantry.filter((row) => !insertIds.has(row.id)),
        ];
      }
      nextGrocery = await replaceGroceryList(supabase, userId, nextGrocery);

      for (const guestRecipe of guestKitchen.recipes) {
        const recipeApiId = parseRecipeApiNumericId(guestRecipe.id);
        const exists = nextRecipes.some((row) => row.id === guestRecipe.id);
        if (!exists && recipeApiId != null) {
          const saved = await upsertImportedRecipe(supabase, userId, guestRecipe, {
            asMaster: false,
            recipeApiId,
          });
          nextRecipes = [saved, ...nextRecipes];
        } else if (!exists) {
          nextRecipes = [guestRecipe, ...nextRecipes];
        }
      }

      const insertedMeals: MealPlanItem[] = [];
      for (const row of merged.mealPlanInserts) {
        insertedMeals.push(await insertMealPlanItem(supabase, userId, row));
      }
      if (insertedMeals.length > 0) {
        const guestIds = new Set(merged.mealPlanInserts.map((row) => row.id));
        nextMealPlan = [
          ...insertedMeals,
          ...nextMealPlan.filter((row) => !guestIds.has(row.id)),
        ];
      }

      clearGuestKitchenStorage();
    }

    removeStorageKey(STORAGE_KEYS.pantry);
    removeStorageKey(STORAGE_KEYS.grocery);
    removeStorageKey(STORAGE_KEYS.mealPlan);
    removeStorageKey(STORAGE_KEYS.recipes);
    setPantry(nextPantry);
    setRecipes(nextRecipes);
    setGrocery(nextGrocery);
    setFeatureFlags(bundle.featureFlags);
    setMealPlan(nextMealPlan);
    setLiveAnalytics(bundle.analytics);
    setLiveDataLoaded(true);
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
    if (!hydrated || demoMode) return;
    if (userId) return;
    setPantry(readGuestPantry());
    setGrocery(readGuestGrocery());
    setMealPlan(readGuestMealPlan());
    setRecipes(readGuestRecipes());
    setLiveDataLoaded(true);
  }, [demoMode, hydrated, userId]);

  useEffect(() => {
    if (demoMode) return;
    if (!userId) {
      return;
    }
    void loadLiveData().catch((error: unknown) => {
      setLiveDataLoaded(true);
      setAuthError(error instanceof Error ? error.message : 'Failed to load kitchen data');
    });
  }, [demoMode, userId, loadLiveData]);

  useEffect(() => {
    if (demoMode || !userId) return;
    runScanPhotoRetentionCleanupIfDue(userId);
  }, [demoMode, userId]);

  const refreshGrocery = useCallback(() => {
    if (!featureFlags.grocerySync) return;
    if (!demoMode && userId && !liveDataLoaded) return;
    const dismissals = readGroceryDismissals(ownerId);
    setGrocery((prev) => {
      const next = buildGroceryList(recipes, plannedRecipeIds, pantry, servingOverrides, prev, {
        groceryDismissals: dismissals,
      });
      if (demoMode) {
        writeJson(STORAGE_KEYS.grocery, next);
        return next;
      }
      if (isGuest) {
        writeGuestGrocery(next);
        return next;
      }
      if (supabase && userId) {
        void enqueueGroceryPersist(() =>
          replaceGroceryList(supabase, userId, next).then((persisted) => {
            setGrocery(persisted);
          }),
        ).catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to save grocery list');
        });
        return next;
      }
      return next;
    });
  }, [
    demoMode,
    isGuest,
    featureFlags.grocerySync,
    liveDataLoaded,
    ownerId,
    pantry,
    plannedRecipeIds,
    recipes,
    servingOverrides,
    supabase,
    userId,
  ]);

  useEffect(() => {
    refreshGrocery();
  }, [pantry, recipes, plannedRecipeIds, servingOverrides, featureFlags.grocerySync, refreshGrocery]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.role, role);
  }, [demoMode, role]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.pantry, pantry);
    else if (isGuest) writeGuestPantry(pantry);
  }, [demoMode, isGuest, pantry]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.recipes, recipes);
    else if (isGuest) writeGuestRecipes(recipes);
  }, [demoMode, isGuest, recipes]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.flags, featureFlags);
  }, [demoMode, featureFlags]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.userPreferences, userPreferences);
  }, [demoMode, userPreferences]);

  useEffect(() => {
    if (demoMode) writeJson(STORAGE_KEYS.mealPlan, mealPlan);
    else if (isGuest) writeGuestMealPlan(mealPlan);
  }, [demoMode, isGuest, mealPlan]);

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

  const pantryRecipeMatches = useMemo(() => {
    const kitchenRecipes = kitchenRecipesForPantryMatch(recipes).map((recipe) =>
      withServingScale(recipe, servingOverrides),
    );
    return buildPantryMatchIndex(kitchenRecipes, pantry);
  }, [pantry, recipes, servingOverrides]);

  const pantryRecipeRecommendations = useMemo(() => {
    const kitchenRecipes = kitchenRecipesForPantryMatch(recipes);
    return topPantryRecipeRecommendations(kitchenRecipes, pantry, 3);
  }, [pantry, recipes]);

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
          emailRedirectTo: getAuthRedirectUrl(),
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
        options: { emailRedirectTo: getAuthRedirectUrl() },
      });
      if (error) setAuthError(error.message);
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setAuthError(null);
    const signedOutOwnerId = profile.id;
    await supabase.auth.signOut();
    if (signedOutOwnerId) {
      clearGroceryDismissals(signedOutOwnerId);
      clearAddPriceMemory(signedOutOwnerId);
    }
    setLiveProfile(null);
    setLiveAnalytics(null);
    setPantry([]);
    setRecipes([]);
    setGrocery([]);
    setMealPlan([]);
    setServingOverrides({});
    setUndoToast(null);
    setMealMadeReview(null);
    setMealMadeUndo(null);
    setLiveDataLoaded(false);
    setPantry(readGuestPantry());
    setGrocery(readGuestGrocery());
    setMealPlan(readGuestMealPlan());
    setRecipes(readGuestRecipes());
    for (const key of Object.values(STORAGE_KEYS)) {
      removeStorageKey(key);
    }
  }, [profile.id, supabase]);

  const isOnMealPlan = useCallback(
    (options: { recipeSlug?: string; recipeApiId?: number }) =>
      Boolean(isRecipeOnMealPlan(mealPlan, options)),
    [mealPlan],
  );

  const persistGroceryList = useCallback(
    (next: GroceryListItem[]) => {
      if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
      else if (isGuest) writeGuestGrocery(next);
      if (!demoMode && supabase && userId) {
        void enqueueGroceryPersist(() =>
          replaceGroceryList(supabase, userId, next).then((persisted) => {
            setGrocery(persisted);
            return persisted;
          }),
        ).catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to save grocery list');
        });
      }
    },
    [demoMode, isGuest, supabase, userId],
  );

  const showGroceryAddedToast = useCallback(
    (added: GroceryListItem[], previous: GroceryListItem[], options?: { alreadyOnList?: boolean }) => {
      const label =
        options?.alreadyOnList
          ? GROCERY_COPY.alreadyOnGroceryList
          : added.length === 1
            ? GROCERY_COPY.addedMissingSingle(added[0].name)
            : GROCERY_COPY.addedMissingPlural(added.length);
      setUndoToast({
        message: label,
        actionLabel: GROCERY_COPY.viewGroceryListAction,
        onAction: () => {
          setUndoToast(null);
          router.push(APP_ROUTES.grocery);
        },
        onUndo: () => {
          const dismissalKeys = added.flatMap((item) =>
            item.sourceRecipeIds.map((recipeId) =>
              groceryDismissalKey(recipeId, item.name, item.unit),
            ),
          );
          addGroceryDismissals(ownerId, dismissalKeys);
          setGrocery(previous);
          persistGroceryList(previous);
          setUndoToast(null);
        },
      });
    },
    [ownerId, persistGroceryList],
  );

  const appendMissingIngredientsForRecipe = useCallback(
    (
      recipeId: string,
      missing: RecipeIngredient[],
      options?: { showToast?: boolean },
    ) => {
      if (missing.length === 0) return 0;

      let addedCount = 0;
      const dismissals = readGroceryDismissals(ownerId);
      setGrocery((prev) => {
        const { items: next, added } = mergeMissingIntoGrocery({
          missing,
          recipeId,
          pantry,
          previous: prev,
          groceryDismissals: dismissals,
        });
        addedCount = added.length;
        persistGroceryList(next);
        if (options?.showToast) {
          if (added.length > 0) {
            showGroceryAddedToast(added, prev);
          } else if (missing.length > 0) {
            showGroceryAddedToast([], prev, { alreadyOnList: true });
          }
        }
        return next;
      });
      return addedCount;
    },
    [ownerId, pantry, persistGroceryList, showGroceryAddedToast],
  );

  const removeMealPlanItem = useCallback(
    async (id: string) => {
      const target = mealPlan.find((row) => row.id === id);
      const deleteIds = idsRemovedByMealPlanDelete(mealPlan, id);
      setMealPlan((prev) => applyMealPlanRemoval(prev, id));
      if (!demoMode && supabase && userId) {
        try {
          if (target?.leftoverOfId) {
            await updateMealPlanItem(supabase, userId, target.leftoverOfId, { linkedLeftoverId: null });
          }
          for (const delId of deleteIds) {
            await deleteMealPlanItem(supabase, userId, delId);
          }
        } catch (error: unknown) {
          setAuthError(error instanceof Error ? error.message : 'Failed to remove meal plan item');
        }
      }
    },
    [demoMode, mealPlan, supabase, userId],
  );

  const openMealMadeReview = useCallback(
    (mealPlanItemId: string) => {
      const item = mealPlan.find((row) => row.id === mealPlanItemId);
      if (!item || item.made) return;

      const recipeId = resolveMealPlanRecipeId(item, recipes, ownerId);
      const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : undefined;
      if (!recipe) return;

      const match = scoreRecipeAgainstPantry(recipe, pantry);
      const rows = matchedRowsForReview(match);
      setMealMadeReview({
        mealPlanItemId,
        selectedPantryIds: new Set(rows.map((row) => row.matchedPantryItem!.id)),
      });
    },
    [mealPlan, ownerId, pantry, recipes],
  );

  const closeMealMadeReview = useCallback(() => {
    setMealMadeReview(null);
  }, []);

  const toggleMealMadePantryUse = useCallback((pantryItemId: string, useFromPantry: boolean) => {
    setMealMadeReview((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.selectedPantryIds);
      if (useFromPantry) next.add(pantryItemId);
      else next.delete(pantryItemId);
      return { ...prev, selectedPantryIds: next };
    });
  }, []);

  const undoLastMealMade = useCallback(
    async (mealPlanItemId?: string) => {
      const targetId = mealPlanItemId ?? mealMadeUndo?.mealPlanItemId;
      if (!targetId || !mealMadeUndo || mealMadeUndo.mealPlanItemId !== targetId) return;

      const { previousMeal, pantrySnapshot, deductionLines } = mealMadeUndo;

      setPantry(pantrySnapshot);
      setMealPlan((prev) => prev.map((row) => (row.id === targetId ? previousMeal : row)));
      setMealMadeUndo(null);
      setUndoToast(null);

      if (!demoMode && supabase && userId) {
        try {
          const currentIds = new Set(pantry.map((row) => row.id));
          const snapshotIds = new Set(pantrySnapshot.map((row) => row.id));
          const removedIds = [...currentIds].filter((id) => !snapshotIds.has(id));
          if (removedIds.length > 0) {
            await deletePantryItemsByIds(supabase, userId, removedIds);
          }
          for (const row of pantrySnapshot) {
            if (deductionLines.some((line) => line.pantryItemId === row.id) || !currentIds.has(row.id)) {
              if (currentIds.has(row.id)) {
                await updatePantryItem(supabase, userId, row);
              } else {
                await insertPantryItem(supabase, userId, row);
              }
            }
          }
          await updateMealPlanItem(supabase, userId, targetId, {
            made: previousMeal.made,
            madeAt: previousMeal.madeAt,
          });
        } catch (error: unknown) {
          setAuthError(error instanceof Error ? error.message : 'Failed to undo');
        }
      }
    },
    [demoMode, mealMadeUndo, pantry, supabase, userId],
  );

  const confirmMealMade = useCallback(async () => {
    if (!mealMadeReview) return;
    const item = mealPlan.find((row) => row.id === mealMadeReview.mealPlanItemId);
    if (!item) {
      setMealMadeReview(null);
      return;
    }

    const recipeId = resolveMealPlanRecipeId(item, recipes, ownerId);
    const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : undefined;
    if (!recipe) {
      setMealMadeReview(null);
      return;
    }

    const match = scoreRecipeAgainstPantry(recipe, pantry);
    const excluded = new Set(
      matchedRowsForReview(match)
        .map((row) => row.matchedPantryItem!.id)
        .filter((id) => !mealMadeReview.selectedPantryIds.has(id)),
    );
    const lines = buildPantryDeductionLines(match, recipe, servingOverrides, excluded);
    const pantrySnapshot = pantry.map((row) => ({ ...row }));
    const { nextPantry } = applyPantryDeductions(pantry, lines);
    const madeAt = new Date().toISOString();
    const previousMeal = { ...item };

    setMealMadeBusy(true);
    try {
      setPantry(nextPantry);
      setMealPlan((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, made: true, madeAt } : row,
        ),
      );
      setMealMadeUndo({
        mealPlanItemId: item.id,
        previousMeal,
        pantrySnapshot,
        deductionLines: lines,
      });

      if (!demoMode && supabase && userId) {
        for (const line of lines) {
          const updated = nextPantry.find((row) => row.id === line.pantryItemId);
          if (updated) {
            await updatePantryItem(supabase, userId, updated);
          } else {
            await deletePantryItemsByIds(supabase, userId, [line.pantryItemId]);
          }
        }
        await updateMealPlanItem(supabase, userId, item.id, { made: true, madeAt });
      }

      setMealMadeReview(null);
      setUndoToast({
        message: `Marked “${item.title}” as made`,
        onUndo: () => {
          void undoLastMealMade(item.id);
        },
      });
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Failed to mark meal as made');
      setPantry(pantrySnapshot);
      setMealPlan((prev) => prev.map((row) => (row.id === item.id ? previousMeal : row)));
    } finally {
      setMealMadeBusy(false);
    }
  }, [
    demoMode,
    mealMadeReview,
    mealPlan,
    ownerId,
    pantry,
    recipes,
    servingOverrides,
    supabase,
    undoLastMealMade,
    userId,
  ]);

  const addMealPlanEntry = useCallback(
    async (entry: Omit<MealPlanItem, 'id'>) => {
      const normalized: Omit<MealPlanItem, 'id'> = {
        ...entry,
        madeAt: entry.madeAt ?? null,
        scheduledOn: entry.scheduledOn ?? null,
        mealSlot: entry.mealSlot ?? null,
        leftoverOfId: entry.leftoverOfId ?? null,
        linkedLeftoverId: entry.linkedLeftoverId ?? null,
      };
      const recipeId = resolveMealPlanRecipeId(
        { ...normalized, id: 'pending' },
        recipes,
        ownerId,
      );

      if (demoMode || isGuest) {
        const id = isGuest ? `guest-plan-${Date.now()}` : `demo-plan-${Date.now()}`;
        setMealPlan((prev) => [{ ...normalized, id }, ...prev]);
        if (
          userPreferences.autoAddMissingToGrocery &&
          recipeId &&
          !normalized.leftoverOfId
        ) {
          const missing = pantryRecipeMatches.byRecipeId.get(recipeId)?.missing ?? [];
          appendMissingIngredientsForRecipe(recipeId, missing, { showToast: true });
        }
        return;
      }
      if (!supabase || !userId) throw new Error('Sign in to save your meal plan.');
      const saved = await insertMealPlanItem(supabase, userId, normalized);
      setMealPlan((prev) => [saved, ...prev]);
      if (
        userPreferences.autoAddMissingToGrocery &&
        recipeId &&
        !normalized.leftoverOfId
      ) {
        const missing = pantryRecipeMatches.byRecipeId.get(recipeId)?.missing ?? [];
        appendMissingIngredientsForRecipe(recipeId, missing, { showToast: true });
      }
    },
    [
      appendMissingIngredientsForRecipe,
      demoMode,
      isGuest,
      ownerId,
      pantryRecipeMatches.byRecipeId,
      recipes,
      supabase,
      userId,
      userPreferences.autoAddMissingToGrocery,
    ],
  );

  const updateMealPlanSchedule = useCallback(
    async (id: string, patch: Partial<Pick<MealPlanItem, 'scheduledOn' | 'mealSlot'>>) => {
      let previous: MealPlanItem | undefined;
      setMealPlan((prev) => {
        previous = prev.find((row) => row.id === id);
        return prev.map((row) => (row.id === id ? { ...row, ...patch } : row));
      });
      if (!previous) return;
      if (demoMode || isGuest) return;
      if (!supabase || !userId) return;
      try {
        await updateMealPlanItem(supabase, userId, id, patch);
      } catch (error: unknown) {
        setMealPlan((prev) => prev.map((row) => (row.id === id ? previous! : row)));
        setAuthError(error instanceof Error ? error.message : 'Failed to update meal schedule');
      }
    },
    [demoMode, isGuest, supabase, userId],
  );

  const scheduleMealFromRecipe = useCallback(
    async (input: {
      recipeId: string;
      recipeSlug: string | null;
      recipeApiId: number | null;
      title: string;
      imageUrl: string | null;
      scheduledOn: string;
      mealSlot: MealSlot;
      makesLeftovers?: boolean;
    }) => {
      const parentBase: Omit<MealPlanItem, 'id'> = {
        recipeSlug: input.recipeSlug,
        recipeApiId: input.recipeApiId,
        title: input.title,
        imageUrl: input.imageUrl,
        made: false,
        madeAt: null,
        addedAt: new Date().toISOString(),
        scheduledOn: input.scheduledOn,
        mealSlot: input.mealSlot,
        leftoverOfId: null,
        linkedLeftoverId: null,
      };

      const maybeAppendMissing = (recipeId: string | null) => {
        if (!userPreferences.autoAddMissingToGrocery || !recipeId) return;
        const missing = pantryRecipeMatches.byRecipeId.get(recipeId)?.missing ?? [];
        appendMissingIngredientsForRecipe(recipeId, missing, { showToast: true });
      };

      if (demoMode || isGuest) {
        const parentId = isGuest ? `guest-plan-${Date.now()}` : `demo-plan-${Date.now()}`;
        let parent: MealPlanItem = { ...parentBase, id: parentId };
        const rows: MealPlanItem[] = [parent];
        if (input.makesLeftovers) {
          const childId = isGuest ? `guest-plan-${Date.now()}-lo` : `demo-plan-${Date.now()}-lo`;
          const child: MealPlanItem = { ...buildLinkedLeftoverEntry(parent), id: childId };
          parent = { ...parent, linkedLeftoverId: childId };
          rows[0] = parent;
          rows.push(child);
        }
        setMealPlan((prev) => [...rows, ...prev]);
        maybeAppendMissing(
          resolveMealPlanRecipeId(parent, recipes, ownerId),
        );
        return;
      }

      if (!supabase || !userId) throw new Error('Sign in to save your meal plan.');
      const savedParent = await insertMealPlanItem(supabase, userId, parentBase);
      let rows: MealPlanItem[] = [savedParent];
      if (input.makesLeftovers) {
        const childBase = buildLinkedLeftoverEntry(savedParent);
        const savedChild = await insertMealPlanItem(supabase, userId, childBase);
        const linkedParent = await updateMealPlanItem(supabase, userId, savedParent.id, {
          linkedLeftoverId: savedChild.id,
        });
        rows = [linkedParent, savedChild];
      }
      setMealPlan((prev) => [...rows, ...prev]);
      maybeAppendMissing(resolveMealPlanRecipeId(rows[0], recipes, ownerId));
    },
    [
      appendMissingIngredientsForRecipe,
      demoMode,
      isGuest,
      ownerId,
      pantryRecipeMatches.byRecipeId,
      recipes,
      supabase,
      userId,
      userPreferences.autoAddMissingToGrocery,
    ],
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
        madeAt: null,
        addedAt: new Date().toISOString(),
        scheduledOn: null,
        mealSlot: null,
        leftoverOfId: null,
        linkedLeftoverId: null,
      });
      notifyTutorialStepCompleteRef.current('recipes');
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
        else if (isGuest) writeGuestGrocery(next);
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
    [demoMode, isGuest, supabase, userId],
  );

  const addManualGroceryItem = useCallback(
    (input: { name: string; quantity: number; unit: string; category: PantryCategory }) => {
      const trimmed = input.name.trim();
      if (!trimmed) return;
      const item = createManualGroceryItem({ ...input, name: trimmed });
      setGrocery((prev) => {
        const next = [...prev, item];
        if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
        else if (isGuest) writeGuestGrocery(next);
        if (supabase && userId) {
          void enqueueGroceryPersist(() => insertGroceryItem(supabase, userId, item))
            .then((saved) => setGrocery((current) => [...current.filter((g) => g.id !== item.id), saved]))
            .catch((error: unknown) => {
              setAuthError(error instanceof Error ? error.message : 'Failed to add grocery item');
            });
        }
        return next;
      });
      notifyTutorialStepCompleteRef.current('grocery');
    },
    [demoMode, isGuest, supabase, userId],
  );

  const clearCheckedGroceryItems = useCallback(() => {
    setGrocery((prev) => {
      const removed = prev.filter((item) => item.checked);
      if (removed.length === 0) return prev;

      const dismissalKeys = removed.flatMap((item) => groceryDismissalKeysForItem(item));
      addGroceryDismissals(ownerId, dismissalKeys);

      const previous = prev;
      const next = prev.filter((item) => !item.checked);
      persistGroceryList(next);

      setUndoToast({
        message: GROCERY_COPY.undoCleared(removed.length),
        onUndo: () => {
          setGrocery(previous);
          persistGroceryList(previous);
          setUndoToast(null);
        },
      });

      return next;
    });
  }, [ownerId, persistGroceryList]);

  const removeGroceryItem = useCallback(
    (id: string) => {
      setGrocery((prev) => {
        const removed = prev.find((item) => item.id === id);
        if (!removed) return prev;

        const dismissalKeys = groceryDismissalKeysForItem(removed);
        addGroceryDismissals(ownerId, dismissalKeys);

        const previous = prev;
        const next = prev.filter((item) => item.id !== id);
        persistGroceryList(next);

        setUndoToast({
          message: GROCERY_COPY.undoRemoved(removed.name),
          onUndo: () => {
            setGrocery(previous);
            persistGroceryList(previous);
            setUndoToast(null);
          },
        });

        return next;
      });
    },
    [ownerId, persistGroceryList],
  );

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
      if (demoMode || isGuest) {
        const saved = { ...recipe, isMaster: isGuest ? false : options.asMaster };
        setRecipes((prev) => {
          const exists = prev.some((r) => r.id === recipe.id);
          const next = exists
            ? prev.map((r) => (r.id === recipe.id ? saved : r))
            : [saved, ...prev];
          if (demoMode) writeJson(STORAGE_KEYS.recipes, next);
          else writeGuestRecipes(next);
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
    [demoMode, isAdmin, isGuest, supabase, userId],
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
        madeAt: null,
        addedAt: new Date().toISOString(),
        scheduledOn: null,
        mealSlot: null,
        leftoverOfId: null,
        linkedLeftoverId: null,
      });
      notifyTutorialStepCompleteRef.current('recipes');
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
    const dismissals = readGroceryDismissals(ownerId);
    setGrocery((prev) => {
      let next = prev;
      const allAdded: GroceryListItem[] = [];
      for (const recipeId of plannedRecipeIds) {
        const match = pantryRecipeMatches.byRecipeId.get(recipeId);
        if (!match || match.missing.length === 0) continue;
        const result = mergeMissingIntoGrocery({
          missing: match.missing,
          recipeId,
          pantry,
          previous: next,
          groceryDismissals: dismissals,
        });
        next = result.items;
        allAdded.push(...result.added);
      }
      if (allAdded.length > 0) {
        persistGroceryList(next);
        showGroceryAddedToast(allAdded, prev);
      }
      return next;
    });
  }, [ownerId, pantry, pantryRecipeMatches.byRecipeId, persistGroceryList, plannedRecipeIds, showGroceryAddedToast]);

  const shopForWeekScheduledMeals = useCallback(() => {
    const startIso = localDateString();
    const weekItems = mealPlanItemsInWeekWindow(mealPlan, startIso, MEAL_CALENDAR.daysAhead);
    const recipeIds = recipeIdsForScheduledMeals(weekItems, recipes, ownerId);
    const dismissals = readGroceryDismissals(ownerId);
    setGrocery((prev) => {
      let next = prev;
      for (const recipeId of recipeIds) {
        const match = pantryRecipeMatches.byRecipeId.get(recipeId);
        if (!match || match.missing.length === 0) continue;
        next = mergeMissingIntoGrocery({
          missing: match.missing,
          recipeId,
          pantry,
          previous: next,
          groceryDismissals: dismissals,
        }).items;
      }
      persistGroceryList(next);
      return next;
    });
    router.push(APP_ROUTES.grocery);
  }, [
    mealPlan,
    ownerId,
    pantry,
    pantryRecipeMatches.byRecipeId,
    persistGroceryList,
    recipes,
  ]);

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
      if (demoMode || isGuest) {
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
    [demoMode, isGuest, supabase, userId],
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
      if (demoMode || isGuest) {
        setPantry((prev) => [item, ...prev]);
        notifyTutorialStepCompleteRef.current('scan');
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to add pantry items.');
      }
      const saved = await insertPantryItem(supabase, userId, item);
      setPantry((prev) => [saved, ...prev]);
      notifyTutorialStepCompleteRef.current('scan');
    },
    [demoMode, isGuest, supabase, userId],
  );

  const updatePantryItemEntry = useCallback(
    async (item: PantryItem) => {
      if (demoMode || isGuest) {
        setPantry((prev) => prev.map((row) => (row.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : row)));
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to update pantry items.');
      }
      const saved = await updatePantryItem(supabase, userId, item);
      setPantry((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    },
    [demoMode, isGuest, supabase, userId],
  );

  const deletePantryItemEntry = useCallback(
    async (id: string) => {
      if (demoMode || isGuest) {
        setPantry((prev) => prev.filter((row) => row.id !== id));
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to update pantry.');
      }
      await deletePantryItemsByIds(supabase, userId, [id]);
      setPantry((prev) => prev.filter((row) => row.id !== id));
    },
    [demoMode, isGuest, supabase, userId],
  );

  const clearPantryLocation = useCallback(
    async (location: PantryStorageLocation) => {
      const ids = pantry.filter((item) => item.location === location).map((item) => item.id);
      if (ids.length === 0) return;
      if (demoMode || isGuest) {
        setPantry((prev) => prev.filter((item) => item.location !== location));
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to update pantry.');
      }
      await deletePantryItemsByIds(supabase, userId, ids);
      setPantry((prev) => prev.filter((item) => item.location !== location));
    },
    [demoMode, isGuest, pantry, supabase, userId],
  );

  const previewPantryResort = useCallback(() => previewResortFromDefaultPantry(pantry), [pantry]);

  const resortPantryItemsInDefaultLocation = useCallback(async () => {
    const preview = previewResortFromDefaultPantry(pantry);
    if (preview.total === 0) return preview;

    const next = pantry.map((item) => resortPantryItemIfDefault(item));
    const changed = next.filter((item, index) => item.location !== pantry[index].location);

    if (demoMode || isGuest) {
      setPantry(next);
      return preview;
    }
    if (!supabase || !userId) {
      throw new Error('Sign in to update pantry items.');
    }

    for (const item of changed) {
      await updatePantryItem(supabase, userId, item);
    }
    setPantry(next);
    return preview;
  }, [demoMode, isGuest, pantry, supabase, userId]);

  const clearAllPantry = useCallback(async () => {
    if (pantry.length === 0) return;
    if (demoMode) {
      removeStorageKey(STORAGE_KEYS.pantry);
      setPantry([]);
      return;
    }
    if (isGuest) {
      writeGuestPantry([]);
      setPantry([]);
      return;
    }
    if (!supabase || !userId) {
      throw new Error('Sign in to update pantry.');
    }
    await deleteAllPantryItems(supabase, userId);
    removeStorageKey(STORAGE_KEYS.pantry);
    setPantry([]);
  }, [demoMode, isGuest, pantry.length, supabase, userId]);

  const savePantryScanReview = useCallback(
    async (items: PantryScanReviewItem[], scanPhotoPath?: string | null) => {
      const toSave = reviewItemsToPantryItems(items, scanPhotoPath);
      if (toSave.length === 0) return;

      const findExisting = (candidate: PantryItem): PantryItem | undefined =>
        pantry.find(
          (row) =>
            row.ingredientId === candidate.ingredientId ||
            ingredientMatchScore(candidate.name, row.name) >= 1 ||
            fuzzyNameScore(candidate.name, row.name) >= 0.92,
        );

      if (demoMode || isGuest) {
        setPantry((prev) => {
          const next = [...prev];
          for (const item of toSave) {
            const existing = next.find(
              (row) =>
                row.ingredientId === item.ingredientId ||
                ingredientMatchScore(item.name, row.name) >= 1 ||
                fuzzyNameScore(item.name, row.name) >= 0.92,
            );
            if (!existing) {
              next.unshift(item);
              continue;
            }
            const sameUnit = existing.unit.toLowerCase() === item.unit.toLowerCase();
            existing.quantity = sameUnit
              ? existing.quantity + item.quantity
              : Math.max(existing.quantity, item.quantity);
            existing.updatedAt = item.updatedAt;
          }
          return next;
        });
        notifyTutorialStepCompleteRef.current('scan');
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to save pantry items.');
      }

      const inserts: PantryItem[] = [];
      const updatedRows: PantryItem[] = [];
      for (const item of toSave) {
        const existing = findExisting(item);
        if (!existing) {
          inserts.push(item);
          continue;
        }
        const sameUnit = existing.unit.toLowerCase() === item.unit.toLowerCase();
        updatedRows.push({
          ...existing,
          quantity: sameUnit ? existing.quantity + item.quantity : Math.max(existing.quantity, item.quantity),
          scanPhotoPath: item.scanPhotoPath ?? existing.scanPhotoPath,
          updatedAt: item.updatedAt,
        });
      }

      const savedUpdates: PantryItem[] = [];
      for (const row of updatedRows) {
        savedUpdates.push(await updatePantryItem(supabase, userId, row));
      }
      const savedInserts = inserts.length > 0 ? await insertPantryItems(supabase, userId, inserts) : [];
      const saved = [...savedInserts, ...savedUpdates];
      setPantry((prev) => {
        const ids = new Set(saved.map((s) => s.id));
        const without = prev.filter((p) => !ids.has(p.id));
        return [...saved, ...without];
      });
      notifyTutorialStepCompleteRef.current('scan');
    },
    [demoMode, isGuest, pantry, supabase, userId],
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
      const match = pantryRecipeMatches.byRecipeId.get(recipeId);
      if (!match) return;
      appendMissingIngredientsForRecipe(recipeId, match.missing, { showToast: true });
    },
    [appendMissingIngredientsForRecipe, pantryRecipeMatches.byRecipeId],
  );

  const addMissingDiscoveryRecipeIngredientsToGrocery = useCallback(
    (item: RecipeDiscoveryListItem) => {
      const recipeId = resolveDiscoveryGroceryRecipeId(recipes, item.id, ownerId);
      const libraryRecipe = recipes.find((row) => row.id === recipeId);
      let missing: RecipeIngredient[];
      if (libraryRecipe) {
        const scaled = withServingScale(libraryRecipe, servingOverrides);
        missing = scoreRecipeAgainstPantry(scaled, pantry).missing;
      } else {
        const scale = recipeServingScale({ id: recipeId, servings: item.servings }, servingOverrides);
        missing = scaleRecipeIngredients(
          scoreDiscoveryRecipeAgainstPantry(item, pantry).missing,
          scale,
        );
      }
      appendMissingIngredientsForRecipe(recipeId, missing, { showToast: true });
    },
    [appendMissingIngredientsForRecipe, ownerId, pantry, recipes, servingOverrides],
  );

  const setUserPreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setUserPreferences((prev) => ({ ...prev, [key]: value }));
      if (!demoMode && supabase && userId && key === 'autoAddMissingToGrocery') {
        void updateProfilePreferences(supabase, userId, {
          autoAddMissingToGrocery: value as boolean,
        }).catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Failed to save preference');
        });
      }
    },
    [demoMode, supabase, userId],
  );

  const dismissUndoToast = useCallback(() => setUndoToast(null), []);

  const mealMadeReviewTitle = useMemo(() => {
    if (!mealMadeReview) return null;
    return mealPlan.find((row) => row.id === mealMadeReview.mealPlanItemId)?.title ?? null;
  }, [mealMadeReview, mealPlan]);

  const mealMadeReviewRows = useMemo(() => {
    if (!mealMadeReview) return [];
    const item = mealPlan.find((row) => row.id === mealMadeReview.mealPlanItemId);
    if (!item) return [];
    const recipeId = resolveMealPlanRecipeId(item, recipes, ownerId);
    const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : undefined;
    if (!recipe) return [];
    return matchedRowsForReview(scoreRecipeAgainstPantry(recipe, pantry));
  }, [mealMadeReview, mealPlan, ownerId, pantry, recipes]);

  const value = useMemo(
    () => ({
      appName: APP_NAME,
      demoMode,
      isGuest,
      profileReady,
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
      openMealMadeReview,
      closeMealMadeReview,
      toggleMealMadePantryUse,
      confirmMealMade,
      undoLastMealMade,
      mealMadeReview,
      mealMadeReviewTitle,
      mealMadeReviewRows,
      mealMadeBusy,
      isOnMealPlan,
      scheduleMealFromRecipe,
      updateMealPlanSchedule,
      shopForWeekScheduledMeals,
      addMissingForPlannedMealsToGrocery,
      userPreferences,
      setUserPreference,
      undoToast,
      dismissUndoToast,
      setServingOverride,
      toggleGroceryItem,
      addManualGroceryItem,
      clearCheckedGroceryItems,
      removeGroceryItem,
      seedPantry,
      updateRecipe,
      importDiscoveredRecipe,
      addPantryFromScan,
      addManualPantryItem,
      updatePantryItemEntry,
      deletePantryItemEntry,
      clearPantryLocation,
      clearAllPantry,
      previewPantryResort,
      resortPantryItemsInDefaultLocation,
      savePantryScanReview,
      setFeatureFlag,
      refreshGrocery,
      pantryRecipeMatches,
      pantryRecipeRecommendations,
      addMissingRecipeIngredientsToGrocery,
      addMissingDiscoveryRecipeIngredientsToGrocery,
      onboarding,
    }),
    [
      addPantryFromScan,
      addManualPantryItem,
      updatePantryItemEntry,
      deletePantryItemEntry,
      clearPantryLocation,
      clearAllPantry,
      previewPantryResort,
      resortPantryItemsInDefaultLocation,
      savePantryScanReview,
      analytics,
      authError,
      authReady,
      demoMode,
      isGuest,
      profileReady,
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
      removeGroceryItem,
      toggleMealPlanKitchenRecipe,
      toggleMealPlanDiscoveryRecipe,
      removeMealPlanItem,
      openMealMadeReview,
      closeMealMadeReview,
      toggleMealMadePantryUse,
      confirmMealMade,
      undoLastMealMade,
      mealMadeReview,
      mealMadeReviewTitle,
      mealMadeReviewRows,
      mealMadeBusy,
      isOnMealPlan,
      scheduleMealFromRecipe,
      updateMealPlanSchedule,
      shopForWeekScheduledMeals,
      addMissingForPlannedMealsToGrocery,
      userPreferences,
      setUserPreference,
      undoToast,
      dismissUndoToast,
      updateRecipe,
      importDiscoveredRecipe,
      pantryRecipeMatches,
      pantryRecipeRecommendations,
      addMissingRecipeIngredientsToGrocery,
      addMissingDiscoveryRecipeIngredientsToGrocery,
      previewPantryResort,
      resortPantryItemsInDefaultLocation,
      onboarding,
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
