import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useHydrated } from '../hooks/useHydrated';
import { useHydrationGatedPersist } from '../hooks/useHydrationGatedPersist';
import type { Session } from '@supabase/supabase-js';
import {
  APP_NAME,
  DEMO_USERS,
  FEATURE_FLAG_DEFAULTS,
  isDemoMode,
  isSupabaseConfigured,
} from '../config/appConfig';
import { GROCERY_COPY } from '../config/grocery';
import { SAVED_RECIPES_COPY } from '../config/savedRecipes';
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
  removeGroceryDismissals,
} from '../lib/grocery/dismissals';
import { applyGroceryCheckRestock, reverseGroceryCheckRestock } from '../lib/grocery/restockLedger';
import { bumpGroceryPersistGeneration, enqueueGroceryPersist } from '../lib/grocery/persistQueue';
import { groceryListsEqual } from '../lib/grocery/fingerprint';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import { GROCERY_LIST_REFRESH_DEBOUNCE_MS } from '../config/grocerySync';
import { groceryDismissalKeysForItem } from '../lib/grocery/removals';
import { addMissingRecipeIngredientsToGrocery as mergeMissingIntoGrocery } from '../lib/recipeMatch/groceryFromMissing';
import { router } from 'expo-router';
import { APP_ROUTES } from '../config/appRoutes';
import { deleteUserAccount } from '../lib/account/deleteAccount';
import {
  isPostSignupSetupDone,
  consumeAwaitingProfileSetup,
  markAwaitingProfileSetup,
  markPostSignupSetupDone,
} from '../lib/account/postSignupSetupStorage';
import type { AvatarUploadResult } from '../lib/avatars/uploadAvatar';
import { clearAvatarPhoto, uploadAvatarImage } from '../lib/avatars/uploadAvatar';
import type { PreparedAvatarImage } from '../lib/avatars/types';
import { MEAL_CALENDAR } from '../config/mealCalendar';
import { USER_PREFERENCE_DEFAULTS } from '../config/userPreferences';
import { filterPantryMatchesForDietPrefs } from '../lib/diet/filterRows';
import {
  DEFAULT_USER_DIET_PREFS,
  readLocalUserDietPrefs,
  writeLocalUserDietPrefs,
} from '../lib/diet/prefs';
import { ingredientLinesFromRecipe } from '../lib/diet/ingredientLines';
import type { UserDietPrefs } from '../lib/diet/types';
import { fetchUserDietPrefs, upsertUserDietPrefs } from '../lib/supabaseDietPrefs';
import {
  applyPantryDeductions,
  buildPantryDeductionLines,
  matchedRowsForReview,
  type PantryDeductionLine,
} from '../lib/mealPlan/pantryDeduction';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import {
  buildPantryMatchIndex,
  filterRankedMatches,
  recipeServingScale,
  scaleRecipeIngredients,
  withServingScale,
  type PantryMatchIndex,
  type RecipePantryMatch,
} from '../lib/recipeMatch';
import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  KITCHEN_LIST_DEFAULT_MIN_PERCENT,
  RECIPE_MATCHING,
} from '../config/recipeMatching';
import { scoreDiscoveryRecipeAgainstPantry } from '../lib/recipeDiscovery/scorePantry';
import {
  kitchenRecipesForPantryMatch,
  recipesForRecipesFeed,
} from '../lib/recipeMatch/kitchenCatalogMerge';
import { usePublishedLibraryRecipes } from '../hooks/usePublishedLibraryRecipes';
import { findKitchenRecipeById } from '../lib/mealPlan/kitchenRecipeLookup';
import {
  groceryItemsToPantryItems,
  mergePantryStock,
} from '../lib/pantry/mergePantryStock';
import { syncPantryToSnapshot } from '../lib/pantry/syncPantrySnapshot';
import { PANTRY_RESTOCK_COPY } from '../config/pantryRestock';
import { PANTRY_SCAN_UI_COPY, writeLastPantryScanLocation } from '../config/pantryScan';
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
import { formatAddedToCalendarMessage } from '../lib/mealCalendar/formatScheduleToast';
import { mergeGuestKitchenIntoAccount } from '../lib/guest/mergeGuestKitchen';
import { clearGuestSavedRecipes, readGuestSavedRecipes } from '../lib/savedRecipes/localStore';
import { mergeGuestSavedRecipesIntoAccount } from '../lib/savedRecipes/supabaseStore';
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
import { recipeWithoutSourceAttribution } from '../lib/recipeImport/clearRecipeSource';
import { mapExtractedImportToRecipe } from '../lib/recipeImport/mapToAppRecipe';
import type { RecipeImportExtractedDto } from '../lib/recipeImport/types';
import {
  resolveDiscoveryRecipeImageUrl,
  resolveKitchenRecipeImageUrl,
} from '../lib/recipes/recipeImageUrl';
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
  updateProfileFields,
  updateProfilePreferences,
  upsertFeatureFlag,
  upsertImportedRecipe,
  upsertLinkImportedRecipe,
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
  showUndo?: boolean;
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
  /** Grocery / kitchen sync errors (shown on Grocery, not Account). */
  kitchenError: string | null;
  clearKitchenError: () => void;
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
  }) => Promise<{ parentId: string; leftoverId?: string | null }>;
  notifyMealScheduled: (
    result: { parentId: string; leftoverId?: string | null },
    scheduledOn: string,
    mealSlot: MealSlot,
  ) => void;
  updateMealPlanSchedule: (
    id: string,
    patch: Partial<Pick<MealPlanItem, 'scheduledOn' | 'mealSlot'>>,
  ) => Promise<void>;
  shopForWeekScheduledMeals: () => void;
  addMissingForPlannedMealsToGrocery: () => void;
  userPreferences: UserPreferences;
  setUserPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  userDietPrefs: UserDietPrefs;
  saveUserDietPrefs: (prefs: UserDietPrefs) => Promise<void>;
  undoToast: UndoToastState | null;
  dismissUndoToast: () => void;
  notifySavedToMyRecipes: (onViewMyRecipes: () => void) => void;
  notifyRemovedFromMyRecipes: (onUndo: () => void) => void;
  notifyMyRecipesSaveFailed: () => void;
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
  saveLinkImportedRecipe: (extracted: RecipeImportExtractedDto) => Promise<Recipe>;
  clearImportedRecipeSource: (recipeId: string) => Promise<void>;
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
  savePantryScanReview: (
    items: PantryScanReviewItem[],
    scanPhotoPath?: string | null,
    scanLocation?: PantryStorageLocation,
  ) => Promise<void>;
  setFeatureFlag: (key: keyof FeatureFlags, value: boolean) => void;
  refreshGrocery: () => void;
  pantryRecipeMatches: PantryMatchIndex;
  /** Pantry-ranked kitchen recipes after diet/allergy hiding rules. */
  pantryRecipeMatchesRankedFiltered: RecipePantryMatch[];
  pantryRecipeRecommendations: RecipePantryMatch[];
  /** Published MealPlanatic library recipes (Supabase). */
  libraryRecipes: Recipe[];
  /** Kitchen + library + imports for Recipes tab and meal-plan grocery resolution. */
  feedKitchenRecipes: Recipe[];
  refreshLibraryRecipes: () => void;
  libraryRecipesLoading: boolean;
  addMissingRecipeIngredientsToGrocery: (recipeId: string, matchOverride?: RecipePantryMatch) => void;
  addMissingDiscoveryRecipeIngredientsToGrocery: (item: RecipeDiscoveryListItem) => void;
  accountUi: {
    sheet: 'closed' | 'auth' | 'account';
    showPostSignupSetup: boolean;
    openAuthSheet: () => void;
    openAccountSheet: () => void;
    closeSheet: () => void;
  };
  openAuthSheet: () => void;
  openAccountSheet: () => void;
  saveProfileSetup: (patch: {
    name?: string;
    homeZip?: string;
    householdSize?: number;
    dietaryNotes?: string;
  }) => Promise<void>;
  uploadProfilePhoto: (prepared: PreparedAvatarImage) => Promise<AvatarUploadResult>;
  removeProfilePhoto: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  completePostSignupSetup: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
  const supabase = demoMode ? null : getSupabase();
  const hydrated = useHydrated();

  const [authReady, setAuthReady] = useState(demoMode);
  const [authError, setAuthError] = useState<string | null>(null);
  const [kitchenError, setKitchenError] = useState<string | null>(null);
  const groceryRestockLedgerRef = useRef(new Map<string, { pantryItemId: string; quantityAdded: number; unit: string }>());
  const [session, setSession] = useState<Session | null>(null);
  const [liveProfile, setLiveProfile] = useState<UserProfile | null>(null);

  const [role, setRole] = useState<UserRole>('admin');
  const [pantry, setPantry] = useState<PantryItem[]>(() =>
    demoMode ? normalizePantryItemList(readJson(STORAGE_KEYS.pantry, [])) : [],
  );
  const [recipes, setRecipes] = useState<Recipe[]>(() => (demoMode ? MOCK_RECIPES : []));
  const [grocery, setGrocery] = useState<GroceryListItem[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlanItem[]>([]);
  const [liveDataLoaded, setLiveDataLoaded] = useState(demoMode);
  const [servingOverrides, setServingOverrides] = useState<Record<string, number>>({});
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(USER_PREFERENCE_DEFAULTS);
  const [userDietPrefs, setUserDietPrefs] = useState<UserDietPrefs>(DEFAULT_USER_DIET_PREFS);
  const [guestKitchenHydrated, setGuestKitchenHydrated] = useState(() => demoMode);

  useEffect(() => {
    if (!hydrated) return;
    setUserDietPrefs(readLocalUserDietPrefs());
    setUserPreferences({
      ...USER_PREFERENCE_DEFAULTS,
      ...readJson(STORAGE_KEYS.userPreferences, USER_PREFERENCE_DEFAULTS),
    });
    setServingOverrides(readJson(STORAGE_KEYS.servingOverrides, {}));
    if (!demoMode) return;
    setRole(readJson(STORAGE_KEYS.role, 'admin'));
    setPantry(normalizePantryItemList(readJson(STORAGE_KEYS.pantry, [])));
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
  const [accountSheet, setAccountSheet] = useState<'closed' | 'auth' | 'account'>('closed');
  const [showPostSignupSetup, setShowPostSignupSetup] = useState(false);
  const [demoProfilePatch, setDemoProfilePatch] = useState<Partial<UserProfile>>({});

  const profile = useMemo<UserProfile>(() => {
    if (demoMode) {
      return { ...profileForRole(role), ...demoProfilePatch, preferences: userPreferences };
    }
    if (liveProfile) {
      return { ...liveProfile, preferences: userPreferences };
    }
    return { ...GUEST_PROFILE, preferences: userPreferences };
  }, [demoMode, demoProfilePatch, liveProfile, role, userPreferences]);
  const isAdmin = profile.role === 'admin';
  const maintenanceActive = featureFlags.maintenanceMode && !isAdmin;
  const userId = session?.user.id ?? null;
  const isGuest = !demoMode && !userId;
  const profileReady = demoMode || isGuest || liveDataLoaded;
  const ownerId = userId ?? (demoMode ? profile.id || 'demo-user' : GUEST_OWNER_ID);

  const {
    libraryRecipes,
    loading: libraryRecipesLoading,
    refreshLibrary: refreshLibraryRecipes,
  } = usePublishedLibraryRecipes();

  const feedKitchenRecipes = useMemo(
    () => recipesForRecipesFeed(recipes, libraryRecipes),
    [libraryRecipes, recipes],
  );

  const plannedRecipeIds = useMemo(
    () => activeMealPlanRecipeIds(mealPlan, feedKitchenRecipes, ownerId),
    [feedKitchenRecipes, mealPlan, ownerId],
  );

  const loadLiveData = useCallback(async () => {
    if (!supabase || !userId) return;
    setLiveDataLoaded(false);
    const guestKitchen = readGuestKitchenSnapshot();
    const bundle = await fetchLiveBundle(supabase, userId);
    if (bundle.profile) {
      setLiveProfile(bundle.profile);
      setUserPreferences((prev) => ({
        ...prev,
        autoAddMissingToGrocery: bundle.profile!.preferences.autoAddMissingToGrocery,
      }));
      hydrateLocationFromProfile(bundle.profile);
    }

    try {
      const remoteDietPrefs = await fetchUserDietPrefs(supabase, userId);
      if (remoteDietPrefs) {
        setUserDietPrefs(remoteDietPrefs);
        writeLocalUserDietPrefs(remoteDietPrefs);
      }
    } catch {
      // Table may not exist until migration is applied.
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

    const guestSavedRecipes = readGuestSavedRecipes();
    if (guestSavedRecipes.length > 0) {
      await mergeGuestSavedRecipesIntoAccount(supabase, userId, guestSavedRecipes);
      clearGuestSavedRecipes();
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

  const clearKitchenError = useCallback(() => setKitchenError(null), []);

  const openAuthSheet = useCallback(() => setAccountSheet('auth'), []);
  const openAccountSheet = useCallback(() => setAccountSheet('account'), []);
  const closeAccountSheet = useCallback(() => setAccountSheet('closed'), []);

  const completePostSignupSetup = useCallback(() => {
    if (userId) markPostSignupSetupDone(userId);
    setShowPostSignupSetup(false);
  }, [userId]);

  const saveUserDietPrefs = useCallback(
    async (prefs: UserDietPrefs) => {
      setUserDietPrefs(prefs);
      writeLocalUserDietPrefs(prefs);
      if (demoMode || !supabase || !userId) return;
      try {
        const saved = await upsertUserDietPrefs(supabase, userId, prefs);
        setUserDietPrefs(saved);
        writeLocalUserDietPrefs(saved);
      } catch {
        // Best-effort until migration is applied.
      }
    },
    [demoMode, supabase, userId],
  );

  const saveProfileSetup = useCallback(
    async (patch: {
      name?: string;
      homeZip?: string;
      householdSize?: number;
      dietaryNotes?: string;
    }) => {
      if (demoMode) {
        setDemoProfilePatch((prev) => ({
          ...prev,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.homeZip !== undefined ? { homeZip: patch.homeZip } : {}),
          ...(patch.householdSize !== undefined ? { householdSize: patch.householdSize } : {}),
          ...(patch.dietaryNotes !== undefined ? { dietaryNotes: patch.dietaryNotes } : {}),
        }));
        if (patch.homeZip) {
          const { persistHomeLocation } = await import('../lib/smartShop/profileLocation');
          await persistHomeLocation({ zip: patch.homeZip });
        }
        return;
      }
      if (!supabase || !userId) throw new Error('Sign in to save your profile.');
      const updated = await updateProfileFields(supabase, userId, {
        name: patch.name,
        homeZip: patch.homeZip,
        householdSize: patch.householdSize,
        dietaryNotes: patch.dietaryNotes,
      });
      setLiveProfile(updated);
      if (patch.homeZip) {
        const { persistHomeLocation } = await import('../lib/smartShop/profileLocation');
        await persistHomeLocation({ zip: patch.homeZip });
      }
    },
    [demoMode, supabase, userId],
  );

  const uploadProfilePhoto = useCallback(
    async (prepared: PreparedAvatarImage) => {
      if (demoMode) {
        const result = { photoUrl: prepared.uri, storagePath: 'demo' };
        setDemoProfilePatch((prev) => ({ ...prev, photoUrl: result.photoUrl }));
        return result;
      }
      if (!userId) throw new Error('Sign in to upload a profile photo.');
      const result = await uploadAvatarImage(prepared, userId);
      setLiveProfile((prev) => (prev ? { ...prev, photoUrl: result.photoUrl } : prev));
      return result;
    },
    [demoMode, userId],
  );

  const removeProfilePhoto = useCallback(async () => {
    if (demoMode) {
      setDemoProfilePatch((prev) => ({ ...prev, photoUrl: null }));
      return;
    }
    if (!userId) return;
    await clearAvatarPhoto(userId);
    setLiveProfile((prev) => (prev ? { ...prev, photoUrl: null } : prev));
  }, [demoMode, userId]);

  useEffect(() => {
    if (demoMode || !supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      const email = nextSession?.user?.email;
      const id = nextSession?.user?.id;
      if (event === 'SIGNED_IN' && email && id && !isPostSignupSetupDone(id)) {
        if (consumeAwaitingProfileSetup(email)) {
          setShowPostSignupSetup(true);
        }
      }
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
    setGuestKitchenHydrated(true);
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

  const refreshGroceryNow = useCallback(() => {
    if (!featureFlags.grocerySync) return;
    if (!demoMode && userId && !liveDataLoaded) return;
    const dismissals = readGroceryDismissals(ownerId);
    const groceryRecipes = feedKitchenRecipes;
    setGrocery((prev) => {
      const next = buildGroceryList(groceryRecipes, plannedRecipeIds, pantry, servingOverrides, prev, {
        groceryDismissals: dismissals,
      });
      if (groceryListsEqual(prev, next)) return prev;
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
          setKitchenError(error instanceof Error ? error.message : 'Failed to save grocery list');
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
    feedKitchenRecipes,
    servingOverrides,
    supabase,
    userId,
  ]);

  const refreshGrocery = useCallback(() => {
    refreshGroceryNow();
  }, [refreshGroceryNow]);

  useEffect(() => {
    const timer = setTimeout(() => refreshGroceryNow(), GROCERY_LIST_REFRESH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    pantry,
    feedKitchenRecipes,
    plannedRecipeIds,
    servingOverrides,
    featureFlags.grocerySync,
    refreshGroceryNow,
  ]);

  const guestKitchenPersistReady = demoMode || (isGuest && guestKitchenHydrated);

  useHydrationGatedPersist(
    hydrated && demoMode,
    () => writeJson(STORAGE_KEYS.role, role),
    [role],
  );

  useHydrationGatedPersist(
    hydrated && guestKitchenPersistReady,
    () => {
      if (demoMode) writeJson(STORAGE_KEYS.pantry, pantry);
      else if (isGuest) writeGuestPantry(pantry);
    },
    [demoMode, isGuest, pantry],
  );

  useHydrationGatedPersist(
    hydrated && guestKitchenPersistReady,
    () => {
      if (demoMode) writeJson(STORAGE_KEYS.recipes, recipes);
      else if (isGuest) writeGuestRecipes(recipes);
    },
    [demoMode, isGuest, recipes],
  );

  useHydrationGatedPersist(
    hydrated && demoMode,
    () => writeJson(STORAGE_KEYS.flags, featureFlags),
    [featureFlags],
  );

  useHydrationGatedPersist(
    hydrated && (demoMode || isGuest || Boolean(userId)),
    () => writeJson(STORAGE_KEYS.userPreferences, userPreferences),
    [demoMode, isGuest, userId, userPreferences],
  );

  useHydrationGatedPersist(
    hydrated && guestKitchenPersistReady,
    () => {
      if (demoMode) writeJson(STORAGE_KEYS.mealPlan, mealPlan);
      else if (isGuest) writeGuestMealPlan(mealPlan);
    },
    [demoMode, isGuest, mealPlan],
  );

  const summary = useMemo<MealPrepSummary>(() => {
    const activePlan = mealPlan.filter((m) => !m.made);
    const selected = recipes.filter((r) => plannedRecipeIds.includes(r.id));
    const proteinGrams = selected.reduce((sum, r) => sum + r.protein, 0);
    return {
      date: hydrated
        ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        : '',
      mealsPlanned: activePlan.length,
      pantryItems: pantry.length,
      groceryRemaining: grocery.filter((g) => !g.checked).length,
      proteinGrams,
    };
  }, [grocery, hydrated, mealPlan, pantry.length, plannedRecipeIds, recipes]);

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
    const kitchenRecipes = feedKitchenRecipes.map((recipe) => withServingScale(recipe, servingOverrides));
    return buildPantryMatchIndex(kitchenRecipes, pantry);
  }, [feedKitchenRecipes, pantry, servingOverrides]);

  const recipeIngredientLinesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const recipe of feedKitchenRecipes) {
      map.set(recipe.id, ingredientLinesFromRecipe(recipe));
    }
    return map;
  }, [feedKitchenRecipes]);

  const pantryRecipeMatchesRankedFiltered = useMemo(
    () =>
      filterPantryMatchesForDietPrefs(
        pantryRecipeMatches.ranked,
        userDietPrefs,
        recipeIngredientLinesById,
      ),
    [pantryRecipeMatches.ranked, recipeIngredientLinesById, userDietPrefs],
  );

  const pantryRecipeRecommendations = useMemo(() => {
    if (pantry.length === 0) return [];
    const ranked = filterRankedMatches(
      pantryRecipeMatchesRankedFiltered,
      'all',
      KITCHEN_LIST_DEFAULT_MIN_PERCENT,
      {
        minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
        pantryItemCount: pantry.length,
      },
    ).slice(0, RECIPE_MATCHING.homeRecommendationsLimit);
    return ranked;
  }, [pantry.length, pantryRecipeMatchesRankedFiltered]);

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: { name: name.trim() || email.split('@')[0] },
        },
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (data.session?.user) {
        setShowPostSignupSetup(true);
      } else if (email.trim()) {
        markAwaitingProfileSetup(email.trim());
      }
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
    closeAccountSheet();
  }, [profile.id, supabase, closeAccountSheet]);

  const deleteAccount = useCallback(async () => {
    await deleteUserAccount();
    await signOut();
    completePostSignupSetup();
  }, [completePostSignupSetup, signOut]);

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
          setKitchenError(error instanceof Error ? error.message : 'Failed to save grocery list');
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
      if (missing.length === 0) {
        if (options?.showToast) {
          setUndoToast({
            message: GROCERY_COPY.nothingMissingOnGroceryList,
            showUndo: false,
            onUndo: () => setUndoToast(null),
          });
        }
        return 0;
      }

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

      const recipeId = resolveMealPlanRecipeId(item, feedKitchenRecipes, ownerId);
      const recipe = recipeId ? feedKitchenRecipes.find((r) => r.id === recipeId) : undefined;
      if (!recipe) return;

      const match = scoreRecipeAgainstPantry(recipe, pantry);
      const rows = matchedRowsForReview(match);
      setMealMadeReview({
        mealPlanItemId,
        selectedPantryIds: new Set(rows.map((row) => row.matchedPantryItem!.id)),
      });
    },
    [feedKitchenRecipes, mealPlan, ownerId, pantry],
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

    const recipeId = resolveMealPlanRecipeId(item, feedKitchenRecipes, ownerId);
    const recipe = recipeId ? feedKitchenRecipes.find((r) => r.id === recipeId) : undefined;
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
    const lines = buildPantryDeductionLines(
      match,
      recipe,
      servingOverrides,
      excluded,
      profile.householdSize,
    );
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
    feedKitchenRecipes,
    profile.householdSize,
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
        feedKitchenRecipes,
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
      feedKitchenRecipes,
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
          resolveMealPlanRecipeId(parent, feedKitchenRecipes, ownerId),
        );
        return {
          parentId: parent.id,
          leftoverId: rows.length > 1 ? rows[1].id : null,
        };
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
      maybeAppendMissing(resolveMealPlanRecipeId(rows[0], feedKitchenRecipes, ownerId));
      return {
        parentId: rows[0].id,
        leftoverId: rows.length > 1 ? rows[1].id : null,
      };
    },
    [
      appendMissingIngredientsForRecipe,
      demoMode,
      isGuest,
      ownerId,
      pantryRecipeMatches.byRecipeId,
      feedKitchenRecipes,
      supabase,
      userId,
      userPreferences.autoAddMissingToGrocery,
    ],
  );

  const notifyMealScheduled = useCallback(
    (
      result: { parentId: string; leftoverId?: string | null },
      scheduledOn: string,
      mealSlot: MealSlot,
    ) => {
      setUndoToast({
        message: formatAddedToCalendarMessage(scheduledOn, mealSlot),
        onUndo: () => {
          void removeMealPlanItem(result.parentId);
        },
      });
    },
    [removeMealPlanItem],
  );

  const toggleMealPlanKitchenRecipe = useCallback(
    async (recipeId: string) => {
      const recipe = findKitchenRecipeById(recipes, recipeId, libraryRecipes);
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
        imageUrl: resolveKitchenRecipeImageUrl(recipe),
        made: false,
        madeAt: null,
        addedAt: new Date().toISOString(),
        scheduledOn: null,
        mealSlot: null,
        leftoverOfId: null,
        linkedLeftoverId: null,
      });
    },
    [addMealPlanEntry, mealPlan, recipes, removeMealPlanItem],
  );

  const restockGroceriesToPantry = useCallback(
    async (items: GroceryListItem[]) => {
      if (!userPreferences.addCheckedItemsToPantry || items.length === 0) return;

      const toRestock = items.filter((item) => !groceryRestockLedgerRef.current.has(item.id));
      if (toRestock.length === 0) return;

      const pantrySnapshot = pantry.map((row) => ({ ...row }));
      let nextPantry = pantry;
      for (const item of toRestock) {
        nextPantry = applyGroceryCheckRestock(nextPantry, item, groceryRestockLedgerRef.current);
      }

      setPantry(nextPantry);

      if (!demoMode && !isGuest && supabase && userId) {
        try {
          const merged = mergePantryStock(pantrySnapshot, groceryItemsToPantryItems(toRestock));
          for (const row of merged.updated) {
            await updatePantryItem(supabase, userId, row);
          }
          if (merged.inserted.length > 0) {
            const saved = await insertPantryItems(supabase, userId, merged.inserted);
            setPantry((prev) => {
              const insertIds = new Set(merged.inserted.map((row) => row.id));
              const without = prev.filter((row) => !insertIds.has(row.id));
              return [...saved, ...without];
            });
          }
        } catch (error: unknown) {
          setKitchenError(error instanceof Error ? error.message : 'Failed to update pantry');
          setPantry(pantrySnapshot);
          for (const item of toRestock) {
            groceryRestockLedgerRef.current.delete(item.id);
          }
          return;
        }
      }

      const toastMessage = PANTRY_RESTOCK_COPY.addedToPantry(toRestock.length);
      setUndoToast({
        message: toastMessage,
        onUndo: () => {
          setPantry(pantrySnapshot);
          setUndoToast(null);
          if (!demoMode && !isGuest && supabase && userId) {
            void syncPantryToSnapshot(supabase, userId, nextPantry, pantrySnapshot).catch((error: unknown) => {
              setAuthError(error instanceof Error ? error.message : 'Failed to undo pantry update');
            });
          }
        },
      });
    },
    [demoMode, isGuest, pantry, supabase, userId, userPreferences.addCheckedItemsToPantry],
  );

  const toggleGroceryItem = useCallback(
    (id: string) => {
      const current = grocery.find((item) => item.id === id);
      const willCheck = Boolean(current && !current.checked);
      const willUncheck = Boolean(current && current.checked);

      setGrocery((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
        if (demoMode) writeJson(STORAGE_KEYS.grocery, next);
        else if (isGuest) writeGuestGrocery(next);
        if (supabase && userId) {
          const changed = next.find((item) => item.id === id);
          if (changed && !changed.id.startsWith('groc-')) {
            void updateGroceryChecked(supabase, changed.id, changed.checked).catch((error: unknown) => {
              setKitchenError(error instanceof Error ? error.message : 'Failed to update grocery item');
            });
          }
        }
        return next;
      });

      if (willCheck && current) {
        void restockGroceriesToPantry([current]);
      } else if (willUncheck && current && userPreferences.addCheckedItemsToPantry) {
        const pantrySnapshot = pantry.map((row) => ({ ...row }));
        setPantry((prev) => reverseGroceryCheckRestock(prev, id, groceryRestockLedgerRef.current));
        if (!demoMode && !isGuest && supabase && userId) {
          void syncPantryToSnapshot(supabase, userId, pantry, pantrySnapshot).catch((error: unknown) => {
            setKitchenError(error instanceof Error ? error.message : 'Failed to update pantry');
          });
        }
      }
    },
    [demoMode, grocery, isGuest, pantry, restockGroceriesToPantry, supabase, userId, userPreferences.addCheckedItemsToPantry],
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
            .then((saved) => {
              if (!saved) return;
              setGrocery((current) => [...current.filter((g) => g.id !== item.id), saved]);
            })
            .catch((error: unknown) => {
              setKitchenError(error instanceof Error ? error.message : 'Failed to add grocery item');
            });
        }
        return next;
      });
    },
    [demoMode, isGuest, supabase, userId],
  );

  const clearCheckedGroceryItems = useCallback(() => {
    const removed = grocery.filter((item) => item.checked);
    if (removed.length === 0) return;

    const dismissalKeys = removed.flatMap((item) => groceryDismissalKeysForItem(item));
    addGroceryDismissals(ownerId, dismissalKeys);

    const previousGrocery = grocery;
    const nextGrocery = grocery.filter((item) => !item.checked);
    persistGroceryList(nextGrocery);
    setGrocery(nextGrocery);

    const restockEnabled = userPreferences.addCheckedItemsToPantry;
    const pantrySnapshot = pantry.map((row) => ({ ...row }));
    let nextPantry = pantry;

    if (restockEnabled) {
      const incoming = groceryItemsToPantryItems(removed);
      const merged = mergePantryStock(pantry, incoming);
      nextPantry = merged.pantry;
      setPantry(nextPantry);

      if (!demoMode && !isGuest && supabase && userId) {
        void (async () => {
          try {
            for (const row of merged.updated) {
              await updatePantryItem(supabase, userId, row);
            }
            if (merged.inserted.length > 0) {
              const saved = await insertPantryItems(supabase, userId, merged.inserted);
              setPantry((prev) => {
                const insertIds = new Set(merged.inserted.map((row) => row.id));
                const without = prev.filter((row) => !insertIds.has(row.id));
                return [...saved, ...without];
              });
            }
          } catch (error: unknown) {
            setAuthError(error instanceof Error ? error.message : 'Failed to update pantry');
            setPantry(pantrySnapshot);
            setGrocery(previousGrocery);
            persistGroceryList(previousGrocery);
          }
        })();
      }
    }

    setUndoToast({
      message: restockEnabled
        ? PANTRY_RESTOCK_COPY.addedToPantry(removed.length)
        : GROCERY_COPY.undoCleared(removed.length),
      onUndo: () => {
        setGrocery(previousGrocery);
        persistGroceryList(previousGrocery);
        if (restockEnabled) {
          setPantry(pantrySnapshot);
          if (!demoMode && !isGuest && supabase && userId) {
            void syncPantryToSnapshot(supabase, userId, nextPantry, pantrySnapshot).catch((error: unknown) => {
              setAuthError(error instanceof Error ? error.message : 'Failed to undo pantry update');
            });
          }
        }
        setUndoToast(null);
      },
    });
  }, [
    demoMode,
    grocery,
    isGuest,
    ownerId,
    pantry,
    persistGroceryList,
    supabase,
    userId,
    userPreferences.addCheckedItemsToPantry,
  ]);

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
            removeGroceryDismissals(ownerId, dismissalKeys);
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

  const saveLinkImportedRecipe = useCallback(
    async (extracted: RecipeImportExtractedDto): Promise<Recipe> => {
      const mapped = mapExtractedImportToRecipe(extracted, ownerId);
      if (demoMode || isGuest) {
        const saved = { ...mapped, isMaster: false };
        setRecipes((prev) => {
          const exists = prev.some((r) => r.id === saved.id);
          const next = exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev];
          if (demoMode) writeJson(STORAGE_KEYS.recipes, next);
          else writeGuestRecipes(next);
          return next;
        });
        return saved;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to save recipes.');
      }
      const saved = await upsertLinkImportedRecipe(supabase, userId, mapped);
      setRecipes((prev) => {
        const exists = prev.some((r) => r.id === saved.id);
        return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev];
      });
      return saved;
    },
    [demoMode, isGuest, ownerId, supabase, userId],
  );

  const clearImportedRecipeSource = useCallback(
    async (recipeId: string) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe?.sourceUrl) return;
      const cleared = recipeWithoutSourceAttribution(recipe);
      if (demoMode || isGuest) {
        setRecipes((prev) => {
          const next = prev.map((r) => (r.id === recipeId ? cleared : r));
          if (demoMode) writeJson(STORAGE_KEYS.recipes, next);
          else writeGuestRecipes(next);
          return next;
        });
        return;
      }
      if (!supabase || !userId) return;
      const saved = await upsertLinkImportedRecipe(supabase, userId, cleared);
      setRecipes((prev) => prev.map((r) => (r.id === recipeId ? saved : r)));
    },
    [demoMode, isGuest, recipes, supabase, userId],
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
        imageUrl: resolveDiscoveryRecipeImageUrl(item),
        made: false,
        madeAt: null,
        addedAt: new Date().toISOString(),
        scheduledOn: null,
        mealSlot: null,
        leftoverOfId: null,
        linkedLeftoverId: null,
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
        return;
      }
      if (!supabase || !userId) {
        throw new Error('Sign in to add pantry items.');
      }
      const saved = await insertPantryItem(supabase, userId, item);
      setPantry((prev) => [saved, ...prev]);
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
    bumpGroceryPersistGeneration();
    groceryRestockLedgerRef.current.clear();
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
    async (
      items: PantryScanReviewItem[],
      scanPhotoPath?: string | null,
      scanLocation?: PantryStorageLocation,
    ) => {
      const toSave = reviewItemsToPantryItems(items, scanPhotoPath);
      if (toSave.length === 0) return;

      if (scanLocation) {
        writeLastPantryScanLocation(scanLocation);
      }

      const pantrySnapshot = pantry.map((row) => ({ ...row }));
      const { pantry: nextPantry, inserted, updated } = mergePantryStock(pantry, toSave);

      setPantry(nextPantry);

      if (!demoMode && !isGuest) {
        if (!supabase || !userId) {
          throw new Error('Sign in to save pantry items.');
        }
        for (const row of updated) {
          await updatePantryItem(supabase, userId, row);
        }
        if (inserted.length > 0) {
          const savedInserts = await insertPantryItems(supabase, userId, inserted);
          setPantry((prev) => {
            const insertIds = new Set(inserted.map((row) => row.id));
            const without = prev.filter((row) => !insertIds.has(row.id));
            return [...savedInserts, ...without];
          });
        }
      }


      setUndoToast({
        message: PANTRY_SCAN_UI_COPY.addedToPantry(toSave.length),
        onUndo: () => {
          setPantry(pantrySnapshot);
          setUndoToast(null);
          if (!demoMode && !isGuest && supabase && userId) {
            void syncPantryToSnapshot(supabase, userId, nextPantry, pantrySnapshot).catch((error: unknown) => {
              setAuthError(error instanceof Error ? error.message : 'Failed to undo pantry update');
            });
          }
        },
      });
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
    (recipeId: string, matchOverride?: RecipePantryMatch) => {
      const match = matchOverride ?? pantryRecipeMatches.byRecipeId.get(recipeId);
      if (!match) {
        setUndoToast({
          message: GROCERY_COPY.addMissingUnavailable,
          showUndo: false,
          onUndo: () => setUndoToast(null),
        });
        return;
      }
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
        missing = scoreRecipeAgainstPantry(
          withServingScale(libraryRecipe, servingOverrides),
          pantry,
        ).missing;
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

  const notifySavedToMyRecipes = useCallback((onViewMyRecipes: () => void) => {
    setUndoToast({
      message: SAVED_RECIPES_COPY.toastSaved,
      showUndo: false,
      actionLabel: SAVED_RECIPES_COPY.myRecipesViewAction,
      onAction: () => {
        setUndoToast(null);
        onViewMyRecipes();
      },
      onUndo: () => setUndoToast(null),
    });
  }, []);

  const notifyRemovedFromMyRecipes = useCallback((onUndo: () => void) => {
    setUndoToast({
      message: SAVED_RECIPES_COPY.toastRemoved,
      onUndo: () => {
        onUndo();
        setUndoToast(null);
      },
    });
  }, []);

  const notifyMyRecipesSaveFailed = useCallback(() => {
    setUndoToast({
      message: SAVED_RECIPES_COPY.toastSaveFailed,
      showUndo: false,
      onUndo: () => setUndoToast(null),
    });
  }, []);

  const mealMadeReviewTitle = useMemo(() => {
    if (!mealMadeReview) return null;
    return mealPlan.find((row) => row.id === mealMadeReview.mealPlanItemId)?.title ?? null;
  }, [mealMadeReview, mealPlan]);

  const mealMadeReviewRows = useMemo(() => {
    if (!mealMadeReview) return [];
    const item = mealPlan.find((row) => row.id === mealMadeReview.mealPlanItemId);
    if (!item) return [];
    const recipeId = resolveMealPlanRecipeId(item, feedKitchenRecipes, ownerId);
    const recipe = recipeId ? feedKitchenRecipes.find((r) => r.id === recipeId) : undefined;
    if (!recipe) return [];
    return matchedRowsForReview(scoreRecipeAgainstPantry(recipe, pantry));
  }, [feedKitchenRecipes, mealMadeReview, mealPlan, ownerId, pantry]);

  const value = useMemo(
    () => ({
      appName: APP_NAME,
      demoMode,
      isGuest,
      profileReady,
      authReady,
      authError,
      kitchenError,
      clearKitchenError,
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
      notifyMealScheduled,
      updateMealPlanSchedule,
      shopForWeekScheduledMeals,
      addMissingForPlannedMealsToGrocery,
      userPreferences,
      setUserPreference,
      userDietPrefs,
      saveUserDietPrefs,
      undoToast,
      dismissUndoToast,
      notifySavedToMyRecipes,
      notifyRemovedFromMyRecipes,
      notifyMyRecipesSaveFailed,
      toggleGroceryItem,
      addManualGroceryItem,
      clearCheckedGroceryItems,
      removeGroceryItem,
      seedPantry,
      updateRecipe,
      importDiscoveredRecipe,
      saveLinkImportedRecipe,
      clearImportedRecipeSource,
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
      pantryRecipeMatchesRankedFiltered,
      pantryRecipeRecommendations,
      libraryRecipes,
      feedKitchenRecipes,
      refreshLibraryRecipes,
      libraryRecipesLoading,
      addMissingRecipeIngredientsToGrocery,
      addMissingDiscoveryRecipeIngredientsToGrocery,
      accountUi: {
        sheet: accountSheet,
        showPostSignupSetup,
        openAuthSheet,
        openAccountSheet,
        closeSheet: closeAccountSheet,
      },
      openAuthSheet,
      openAccountSheet,
      saveProfileSetup,
      uploadProfilePhoto,
      removeProfilePhoto,
      deleteAccount,
      completePostSignupSetup,
    }),
    [
      accountSheet,
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
      kitchenError,
      clearKitchenError,
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
      notifyMealScheduled,
      updateMealPlanSchedule,
      shopForWeekScheduledMeals,
      addMissingForPlannedMealsToGrocery,
      userPreferences,
      setUserPreference,
      userDietPrefs,
      saveUserDietPrefs,
      undoToast,
      dismissUndoToast,
      notifySavedToMyRecipes,
      notifyRemovedFromMyRecipes,
      notifyMyRecipesSaveFailed,
      updateRecipe,
      importDiscoveredRecipe,
      saveLinkImportedRecipe,
      clearImportedRecipeSource,
      pantryRecipeMatches,
      pantryRecipeMatchesRankedFiltered,
      pantryRecipeRecommendations,
      libraryRecipes,
      feedKitchenRecipes,
      refreshLibraryRecipes,
      libraryRecipesLoading,
      addMissingRecipeIngredientsToGrocery,
      addMissingDiscoveryRecipeIngredientsToGrocery,
      previewPantryResort,
      resortPantryItemsInDefaultLocation,
      notifyMealScheduled,
      scheduleMealFromRecipe,
      shopForWeekScheduledMeals,
      showPostSignupSetup,
      openAuthSheet,
      openAccountSheet,
      closeAccountSheet,
      saveProfileSetup,
      uploadProfilePhoto,
      removeProfilePhoto,
      deleteAccount,
      completePostSignupSetup,
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
