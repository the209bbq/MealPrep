import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import {
  parseStoredRecipesTabFilterState,
  RECIPES_TAB_FILTERS_STORAGE_KEY,
} from '../../config/recipesTabFilters';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  useWindowDimensions,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionEnabled } from '../../hooks/useReduceMotionEnabled';
import {
  FORKINATOR_ACCESSIBILITY_HINT,
  FORKINATOR_ACCESSIBILITY_LABEL,
} from '../../lib/forkinator/a11y';
import {
  FORKINATOR_HIT_HEIGHT_PX,
  FORKINATOR_HIT_INSET_LEFT_PX,
  FORKINATOR_HIT_INSET_TOP_PX,
  FORKINATOR_HIT_WIDTH_PX,
} from '../../lib/forkinator/hitArea';
import {
  FORKINATOR_GREETING_AUTO_HIDE_MS,
  FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS,
  markForkinatorGreetingShown,
  readForkinatorGreetingShown,
} from '../../lib/forkinator/greetingShown';
import {
  openPantryCameraScanFromForkinator,
  openPantryScannerFromForkinator,
  openPantryWithWebShelfScanFile,
} from '../../lib/forkinator/openPantryScanner';
import { canSyncForkinatorWebCameraScan } from '../../lib/forkinator/forkinatorWebCameraScan';
import { pickWebImageFile } from '../../lib/web/pickWebImageFile';
import { useApp } from '../../context/AppContext';
import { readForkinatorHasScanned } from '../../lib/forkinator/hasScanned';
import {
  markForkinatorAisleSortPromptShown,
  markForkinatorAisleSortUsed,
  readForkinatorAisleSortUsed,
  shouldAutoShowForkinatorAisleSortPrompt,
} from '../../lib/forkinator/aisleSortPrompt';
import {
  FORKINATOR_AISLE_SORT_A11Y_LABEL,
  FORKINATOR_AISLE_SORT_BUTTON_A11Y_LABEL,
  FORKINATOR_AISLE_SORT_BUTTON_LABEL,
  FORKINATOR_AISLE_SORT_MESSAGE,
} from '../../lib/forkinator/aisleSortPromptCopy';
import {
  markForkinatorExpirationPromptShown,
  shouldAutoShowForkinatorExpirationPrompt,
} from '../../lib/forkinator/expirationPrompt';
import {
  buildForkinatorExpirationPromptMessage,
  FORKINATOR_EXPIRATION_PROMPT_A11Y_LABEL,
  FORKINATOR_EXPIRATION_SHOW_BUTTON_A11Y_LABEL,
  FORKINATOR_EXPIRATION_SHOW_BUTTON_LABEL,
} from '../../lib/forkinator/expirationPromptCopy';
import { openPantryExpiringHighlightFromForkinator } from '../../lib/forkinator/openPantryExpiringHighlight';
import {
  FORKINATOR_GREETING_A11Y_LABEL,
  FORKINATOR_GREETING_MESSAGE,
  FORKINATOR_SCANNER_CAMERA_BUTTON_A11Y_LABEL,
  FORKINATOR_SCANNER_CAMERA_BUTTON_LABEL,
  FORKINATOR_SCANNER_NUDGE_A11Y_LABEL,
  FORKINATOR_SCANNER_NUDGE_MESSAGE,
} from '../../lib/forkinator/scannerNudgeCopy';
import {
  hasMealPlanGroceryGrouping,
  readGroceryCombinePreference,
  writeGroceryCombinePreference,
} from '../../lib/grocery/grouping';
import { requestGroceryAisleCombineView } from '../../lib/grocery/groceryCombineRequest';
import { APP_ROUTES } from '../../config/appRoutes';
import type { PantryItem } from '../../types/mealprep';
import {
  FORK_IN_ROAD_PILL_MIN_WIDTH_PX,
  layoutForkInRoadPill,
} from '../../lib/forkinator/forkInRoadPillLayout';
import {
  clampForkinatorPosition,
  defaultForkinatorPositionForTab,
  FORKINATOR_HEIGHT_PX,
  FORKINATOR_WIDTH_PX,
  readForkinatorPosition,
  resolveForkinatorPosition,
  writeForkinatorPosition,
  type ForkinatorBounds,
  type ForkinatorPosition,
} from '../../lib/forkinator/position';
import { layoutScannerPrompt } from '../../lib/forkinator/scannerPromptLayout';
import {
  FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS,
  markForkinatorScannerNudgeShown,
  resolveForkinatorMascotTapAction,
  shouldAutoShowForkinatorScannerPrompt,
} from '../../lib/forkinator/scannerNudgeCooldown';
import {
  FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS,
  isForkinatorTapRelease,
} from '../../lib/forkinator/tapGesture';
import {
  forkinatorDragSurfaceWebStyle,
  forkinatorMascotImageWebStyle,
} from '../../lib/forkinator/webTouchStyle';
import {
  resolveForkinatorMascotPose,
  type ForkinatorMascotPose,
} from '../../lib/forkinator/forkinatorPose';
import { ForkinatorScannerPrompt } from './ForkinatorScannerPrompt';
import { ForkInRoadPrompt } from './ForkInRoadPrompt';
import { ForkInRoadQuizSheet } from './ForkInRoadQuizSheet';
import {
  buildRestockReminderMessage,
  planStapleRestockLinesForCook,
  stapleDisplayNameForMessage,
} from '../../lib/forkinator/restockReminders';
import {
  consumeForkinatorRestockAfterCook,
  subscribeForkinatorRestockAfterCook,
} from '../../lib/forkinator/restockAfterCookEvent';
import { subscribeForkinatorTipsReset } from '../../lib/forkinator/resetForkinatorTipsEvent';
import {
  FORKINATOR_RESTOCK_PROMPT_A11Y_LABEL,
  FORKINATOR_RESTOCK_UNDO_BUTTON_A11Y_LABEL,
  FORKINATOR_RESTOCK_UNDO_BUTTON_LABEL,
} from '../../lib/forkinator/restockPromptCopy';
import {
  markForkInRoadPromptEngaged,
} from '../../lib/forkinator/forkInRoadPrompt';
import { FORKINATOR_FORK_IN_ROAD_MESSAGE } from '../../lib/forkinator/forkInRoadPromptCopy';
import { buildForkInRoadCandidateRows } from '../../lib/forkinator/forkInRoadQuiz';
import { filterRecipesTabRowsForDietPrefs } from '../../lib/diet/filterRows';
import { kitchenRecipesForPantryMatch } from '../../lib/recipeMatch/kitchenCatalogMerge';
import { readGuestPantry } from '../../lib/guest/localKitchenStore';
import { readJson } from '../../lib/storage';
import {
  FORKINATOR_AUTO_PROMPT_PRIORITY,
  shouldReplaceForkinatorAutoPrompt,
  type ForkinatorAutoPromptKind,
} from '../../lib/forkinator/forkinatorActivePrompt';
import type { RecipesTabRow } from '../../config/recipesTabFilters';

const FORKINATOR_MASCOT_POSE_SOURCES: Record<ForkinatorMascotPose, number> = {
  full: require('../../assets/forkinator/forkinator-full.png'),
  idea: require('../../assets/forkinator/forkinator-idea.png'),
  thinking: require('../../assets/forkinator/forkinator-thinking.png'),
  sad: require('../../assets/forkinator/forkinator-sad.png'),
};

const IS_WEB = Platform.OS === 'web';

type PointerTrack = {
  pointerId: number;
  startPageX: number;
  startPageY: number;
  startedAt: number;
  maxDistance: number;
};

export function ForkinatorOverlay() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const pathname = usePathname();
  const {
    demoMode,
    isGuest,
    authReady,
    session,
    profile,
    profileReady,
    featureFlags,
    grocery,
    mealPlan,
    pantry,
    addManualGroceryItem,
    removeGroceryItem,
    feedKitchenRecipes,
    recipes,
    pantryRecipeMatches,
    userDietPrefs,
    kitchenPantryReady,
    mealMadeReview,
  } = useApp();
  const pantryForForkinator = useMemo(() => {
    if (!isGuest || pantry.length > 0) return pantry;
    if (!kitchenPantryReady) return pantry;
    return readGuestPantry();
  }, [isGuest, kitchenPantryReady, pantry]);

  const photoScanAccess = useMemo(
    () => ({
      demoMode,
      authReady,
      hasSession: Boolean(session),
      plan: profile.plan,
      role: profile.role,
      profileReady,
    }),
    [authReady, demoMode, profile.plan, profile.role, profileReady, session],
  );
  const [dragPosition, setDragPosition] = useState<ForkinatorPosition | null>(null);
  const [greetingPromptVisible, setGreetingPromptVisible] = useState(false);
  const [scannerPromptVisible, setScannerPromptVisible] = useState(false);
  const [expirationPromptVisible, setExpirationPromptVisible] = useState(false);
  const [aisleSortPromptVisible, setAisleSortPromptVisible] = useState(false);
  const [restockPromptVisible, setRestockPromptVisible] = useState(false);
  const [restockPromptMessage, setRestockPromptMessage] = useState('');
  const [restockUndoLines, setRestockUndoLines] = useState<
    { id: string | null; name: string; unit: string }[]
  >([]);
  const [forkInRoadExpanded, setForkInRoadExpanded] = useState(false);
  const [forkInRoadQuizVisible, setForkInRoadQuizVisible] = useState(false);
  const [mascotImageLoaded, setMascotImageLoaded] = useState(false);
  const [expirationPromptItems, setExpirationPromptItems] = useState<PantryItem[]>([]);
  const [tipsAutoShowEpoch, setTipsAutoShowEpoch] = useState(0);
  const positionRef = useRef<ForkinatorPosition | null>(null);
  const dragOrigin = useRef<ForkinatorPosition>({ x: 0, y: 0 });
  const pressStartedAt = useRef(0);
  const pointerTrackRef = useRef<PointerTrack | null>(null);
  const dragSurfaceRef = useRef<View>(null);
  const greetingAutoShowStartedRef = useRef(false);
  const expirationAutoShowStartedRef = useRef(false);
  const scannerAutoShowStartedRef = useRef(false);
  const lastPointerActivateAtRef = useRef(0);
  const autoShowPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockScannerThisSessionRef = useRef(false);
  const greetingPromptVisibleRef = useRef(false);
  const scannerPromptVisibleRef = useRef(false);
  const expirationPromptVisibleRef = useRef(false);
  const aisleSortPromptVisibleRef = useRef(false);
  const restockPromptVisibleRef = useRef(false);
  const forkInRoadPromptVisibleRef = useRef(false);
  const sessionAutoPromptShownRef = useRef(false);
  /** Auto-prompt whose timer is scheduled but not fired yet (FK3-7). */
  const pendingAutoPromptKindRef = useRef<ForkinatorAutoPromptKind | null>(null);
  const restockHandledForCookRef = useRef(false);
  const aisleCheckedOnPathRef = useRef(false);

  const visibleAutoPromptKind = useCallback((): ForkinatorAutoPromptKind | null => {
    if (greetingPromptVisibleRef.current) return 'greeting';
    if (expirationPromptVisibleRef.current) return 'expiration';
    if (restockPromptVisibleRef.current) return 'restock';
    if (aisleSortPromptVisibleRef.current) return 'aisleSort';
    if (scannerPromptVisibleRef.current) return 'scanner';
    if (forkInRoadPromptVisibleRef.current) return 'forkInRoad';
    return null;
  }, []);

  /**
   * Show one auto prompt. A lower-priority prompt never replaces a visible higher one
   * (FK3-7); `force` is for prompts caused by the user's own action (restock after cooking).
   */
  const showAutoPrompt = useCallback((kind: ForkinatorAutoPromptKind, options?: { force?: boolean }) => {
    const current = visibleAutoPromptKind();
    if (
      !options?.force &&
      current &&
      current !== kind &&
      !shouldReplaceForkinatorAutoPrompt(current, kind)
    ) {
      return false;
    }
    const setters: Record<ForkinatorAutoPromptKind, (v: boolean) => void> = {
      greeting: setGreetingPromptVisible,
      expiration: setExpirationPromptVisible,
      restock: setRestockPromptVisible,
      aisleSort: setAisleSortPromptVisible,
      scanner: setScannerPromptVisible,
      // Fork in the road is derived (always on while on Home); it is never auto-scheduled.
      forkInRoad: () => {},
    };
    const setter = setters[kind];
    setGreetingPromptVisible(false);
    setExpirationPromptVisible(false);
    setRestockPromptVisible(false);
    setAisleSortPromptVisible(false);
    setScannerPromptVisible(false);
    setter(true);
    greetingPromptVisibleRef.current = kind === 'greeting';
    expirationPromptVisibleRef.current = kind === 'expiration';
    restockPromptVisibleRef.current = kind === 'restock';
    aisleSortPromptVisibleRef.current = kind === 'aisleSort';
    scannerPromptVisibleRef.current = kind === 'scanner';
    sessionAutoPromptShownRef.current = true;
    return true;
  }, [visibleAutoPromptKind]);

  const bounds: ForkinatorBounds = useMemo(
    () => ({
      width,
      height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
    }),
    [height, insets.bottom, insets.left, insets.right, insets.top, width],
  );

  const isGroceryScreen =
    pathname === '/grocery' ||
    pathname.endsWith('/grocery') ||
    pathname.includes('/(tabs)/grocery');
  const isHomeScreen =
    pathname === '/' ||
    pathname === '/index' ||
    pathname.endsWith('/index') ||
    pathname === '/(tabs)' ||
    pathname.endsWith('/(tabs)');

  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    if (!readForkinatorPosition()) return;
    resolveForkinatorPosition(bounds);
  }, [bounds, height, tipsAutoShowEpoch, width]);

  const persistedPosition = useMemo((): ForkinatorPosition | null => {
    if (width <= 0 || height <= 0) return null;
    const stored = readForkinatorPosition();
    if (!stored) return null;
    return clampForkinatorPosition(stored, bounds);
  }, [bounds, height, tipsAutoShowEpoch, width]);

  const tabDefaultPosition = useMemo(
    () =>
      width > 0 && height > 0
        ? clampForkinatorPosition(defaultForkinatorPositionForTab(bounds, isHomeScreen), bounds)
        : null,
    [bounds, height, isHomeScreen, width],
  );

  const position = dragPosition ?? persistedPosition ?? tabDefaultPosition;

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    greetingPromptVisibleRef.current = greetingPromptVisible;
  }, [greetingPromptVisible]);

  useEffect(() => {
    scannerPromptVisibleRef.current = scannerPromptVisible;
  }, [scannerPromptVisible]);

  useEffect(() => {
    expirationPromptVisibleRef.current = expirationPromptVisible;
  }, [expirationPromptVisible]);

  useEffect(() => {
    aisleSortPromptVisibleRef.current = aisleSortPromptVisible;
  }, [aisleSortPromptVisible]);

  useEffect(() => {
    restockPromptVisibleRef.current = restockPromptVisible;
  }, [restockPromptVisible]);

  const openGroceryCount = useMemo(() => grocery.filter((item) => !item.checked).length, [grocery]);
  const groceryCombineByAisle = readGroceryCombinePreference();
  const showMealGrouping = hasMealPlanGroceryGrouping(mealPlan);
  const expirationExpirationMessage = useMemo(
    () => buildForkinatorExpirationPromptMessage(expirationPromptItems),
    [expirationPromptItems],
  );

  useEffect(() => {
    if (!greetingPromptVisible) return;
    const timer = setTimeout(() => setGreetingPromptVisible(false), FORKINATOR_GREETING_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [greetingPromptVisible]);

  useEffect(() => {
    return subscribeForkinatorTipsReset(() => {
      if (autoShowPromptTimerRef.current != null) {
        clearTimeout(autoShowPromptTimerRef.current);
        autoShowPromptTimerRef.current = null;
      }
      greetingAutoShowStartedRef.current = false;
      expirationAutoShowStartedRef.current = false;
      scannerAutoShowStartedRef.current = false;
      blockScannerThisSessionRef.current = false;
      sessionAutoPromptShownRef.current = false;
      pendingAutoPromptKindRef.current = null;
      aisleCheckedOnPathRef.current = false;
      setGreetingPromptVisible(false);
      setScannerPromptVisible(false);
      setExpirationPromptVisible(false);
      setAisleSortPromptVisible(false);
      setRestockPromptVisible(false);
      setForkInRoadExpanded(false);
      setForkInRoadQuizVisible(false);
      setMascotImageLoaded(false);
      setExpirationPromptItems([]);
      setRestockPromptMessage('');
      setRestockUndoLines([]);
      setDragPosition(null);
      setTipsAutoShowEpoch((epoch) => epoch + 1);
    });
  }, []);

  const mascotReady = position !== null && width > 0 && height > 0;
  const forkinatorUiReady = mascotReady && mascotImageLoaded;

  useEffect(() => {
    if (!mascotReady || !kitchenPantryReady) return;

    const delay = FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS;

    if (!readForkinatorGreetingShown()) {
      if (greetingAutoShowStartedRef.current) return;
      greetingAutoShowStartedRef.current = true;
      blockScannerThisSessionRef.current = true;
      pendingAutoPromptKindRef.current = 'greeting';
      autoShowPromptTimerRef.current = setTimeout(() => {
        autoShowPromptTimerRef.current = null;
        pendingAutoPromptKindRef.current = null;
        if (sessionAutoPromptShownRef.current) return;
        if (showAutoPrompt('greeting')) markForkinatorGreetingShown();
      }, FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS);
      return;
    }

    const expirationPlan = shouldAutoShowForkinatorExpirationPrompt(pantryForForkinator);
    if (expirationPlan.show) {
      if (expirationAutoShowStartedRef.current) return;
      expirationAutoShowStartedRef.current = true;
      pendingAutoPromptKindRef.current = 'expiration';
      autoShowPromptTimerRef.current = setTimeout(() => {
        autoShowPromptTimerRef.current = null;
        pendingAutoPromptKindRef.current = null;
        if (sessionAutoPromptShownRef.current) return;
        setExpirationPromptItems(expirationPlan.items);
        if (showAutoPrompt('expiration')) {
          markForkinatorExpirationPromptShown(expirationPlan.items.map((item) => item.id));
        }
      }, delay);
      return;
    }

    if (blockScannerThisSessionRef.current) return;
    if (scannerAutoShowStartedRef.current) return;
    if (!shouldAutoShowForkinatorScannerPrompt(readForkinatorHasScanned())) return;

    scannerAutoShowStartedRef.current = true;
    pendingAutoPromptKindRef.current = 'scanner';
    autoShowPromptTimerRef.current = setTimeout(() => {
      autoShowPromptTimerRef.current = null;
      pendingAutoPromptKindRef.current = null;
      if (blockScannerThisSessionRef.current) return;
      if (sessionAutoPromptShownRef.current) return;
      if (!shouldAutoShowForkinatorScannerPrompt(readForkinatorHasScanned())) return;
      if (showAutoPrompt('scanner')) markForkinatorScannerNudgeShown();
    }, delay);
  }, [kitchenPantryReady, mascotReady, pantryForForkinator, showAutoPrompt, tipsAutoShowEpoch]);

  useEffect(() => {
    if (!isGroceryScreen) {
      aisleCheckedOnPathRef.current = false;
      return;
    }
    if (!mascotReady || !kitchenPantryReady) return;
    if (sessionAutoPromptShownRef.current) return;
    if (aisleCheckedOnPathRef.current) return;
    const pendingKind = pendingAutoPromptKindRef.current;
    if (
      pendingKind &&
      FORKINATOR_AUTO_PROMPT_PRIORITY[pendingKind] > FORKINATOR_AUTO_PROMPT_PRIORITY.aisleSort
    ) {
      // Greeting/expiration is about to show; don't burn aisle's once-a-day slot (FK3-7).
      return;
    }
    const aisleEligible = shouldAutoShowForkinatorAisleSortPrompt({
      openGroceryItemCount: openGroceryCount,
      showMealGrouping,
      combineByAisle: groceryCombineByAisle,
    });
    if (!aisleEligible) {
      if (
        readForkinatorAisleSortUsed() ||
        groceryCombineByAisle ||
        (showMealGrouping && openGroceryCount >= 5)
      ) {
        aisleCheckedOnPathRef.current = true;
      }
      return;
    }
    aisleCheckedOnPathRef.current = true;
    if (showAutoPrompt('aisleSort')) markForkinatorAisleSortPromptShown();
  }, [
    groceryCombineByAisle,
    isGroceryScreen,
    kitchenPantryReady,
    mascotReady,
    openGroceryCount,
    showMealGrouping,
    showAutoPrompt,
  ]);

  // FK3-8: aisle and fork-in-the-road prompts belong to their own screens, and the Made-it
  // review sheet counts as busy (adjusted during render, not in an effect).
  const mealMadeReviewOpen = mealMadeReview != null;
  if (aisleSortPromptVisible && !isGroceryScreen) {
    setAisleSortPromptVisible(false);
  }
  if (!isHomeScreen && forkInRoadExpanded) {
    setForkInRoadExpanded(false);
  }

  useEffect(() => {
    if (!greetingPromptVisible) return;
    setAisleSortPromptVisible(false);
    setScannerPromptVisible(false);
  }, [greetingPromptVisible]);

  useEffect(() => {
    return () => {
      if (autoShowPromptTimerRef.current != null) {
        clearTimeout(autoShowPromptTimerRef.current);
        autoShowPromptTimerRef.current = null;
      }
    };
  }, []);

  const processRestockAfterCook = useCallback(async () => {
    const payload = consumeForkinatorRestockAfterCook();
    if (!payload?.pantryDeductionApplied) return;
    if (restockHandledForCookRef.current) return;
    restockHandledForCookRef.current = true;

    const lines = planStapleRestockLinesForCook(
      payload.nextPantry,
      payload.deductedPantryRows ?? [],
      grocery,
    );
    if (lines.length === 0) return;

    const undoLines: { id: string | null; name: string; unit: string }[] = [];
    for (const line of lines) {
      const id = await addManualGroceryItem({
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        category: line.category,
      });
      undoLines.push({ id, name: line.name, unit: line.unit });
    }

    const messageNames = lines.map((line) => stapleDisplayNameForMessage(line.stapleId, line.name));
    setRestockUndoLines(undoLines);
    setRestockPromptMessage(buildRestockReminderMessage(messageNames));
    showAutoPrompt('restock', { force: true });
  }, [addManualGroceryItem, grocery, showAutoPrompt]);

  useEffect(() => {
    const unsubscribe = subscribeForkinatorRestockAfterCook(() => {
      restockHandledForCookRef.current = false;
      void processRestockAfterCook();
    });
    return unsubscribe;
  }, [processRestockAfterCook]);

  const forkInRoadCandidateRows = useMemo((): RecipesTabRow[] => {
    const filterState = parseStoredRecipesTabFilterState(
      readJson(RECIPES_TAB_FILTERS_STORAGE_KEY, null),
    );
    const kitchenSource =
      feedKitchenRecipes.length > 0
        ? feedKitchenRecipes
        : kitchenRecipesForPantryMatch(recipes);
    const rows = buildForkInRoadCandidateRows({
      kitchenRecipes: kitchenSource,
      pantryMatches: pantryRecipeMatches,
      filterState,
    });
    return filterRecipesTabRowsForDietPrefs(rows, userDietPrefs);
  }, [feedKitchenRecipes, pantryRecipeMatches, recipes, userDietPrefs]);

  /**
   * Fork in the road (meal suggestions) stays up the whole time the user is on Home/recipes:
   * no idle wait, daily limit, or dismissal cooldown. It yields to any other prompt, hides
   * while the Made-it review or the quiz is open, and leaving Home hides it.
   */
  const forkInRoadPromptVisible =
    forkinatorUiReady &&
    isHomeScreen &&
    !mealMadeReviewOpen &&
    !forkInRoadQuizVisible &&
    !greetingPromptVisible &&
    !expirationPromptVisible &&
    !restockPromptVisible &&
    !aisleSortPromptVisible &&
    !scannerPromptVisible &&
    forkInRoadCandidateRows.length > 0;

  useEffect(() => {
    forkInRoadPromptVisibleRef.current = forkInRoadPromptVisible;
  }, [forkInRoadPromptVisible]);

  const collapseForkInRoadPrompt = useCallback(() => {
    setForkInRoadExpanded(false);
  }, []);

  const handleMascotImageLoad = useCallback(() => {
    setMascotImageLoaded(true);
  }, []);

  const greetingPromptLayout = useMemo(() => {
    if (!position) return null;
    return layoutScannerPrompt({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      message: FORKINATOR_GREETING_MESSAGE,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const expirationPromptLayout = useMemo(() => {
    if (!position || expirationPromptItems.length === 0) return null;
    return layoutScannerPrompt({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      message: expirationExpirationMessage,
      includeActionButton: true,
    });
  }, [
    expirationExpirationMessage,
    expirationPromptItems.length,
    height,
    insets.bottom,
    insets.left,
    insets.right,
    insets.top,
    position,
    width,
  ]);

  const aisleSortPromptLayout = useMemo(() => {
    if (!position) return null;
    return layoutScannerPrompt({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      message: FORKINATOR_AISLE_SORT_MESSAGE,
      includeActionButton: true,
      preferAboveBeforeSide: true,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const restockPromptLayout = useMemo(() => {
    if (!position || !restockPromptMessage) return null;
    return layoutScannerPrompt({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      message: restockPromptMessage,
      includeActionButton: true,
    });
  }, [
    height,
    insets.bottom,
    insets.left,
    insets.right,
    insets.top,
    position,
    restockPromptMessage,
    width,
  ]);

  const forkInRoadPillLayout = useMemo(() => {
    if (!position) return null;
    return layoutForkInRoadPill({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      pillWidth: FORK_IN_ROAD_PILL_MIN_WIDTH_PX,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const forkInRoadCloudLayout = useMemo(() => {
    if (!position) return null;
    return layoutScannerPrompt({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      message: FORKINATOR_FORK_IN_ROAD_MESSAGE,
      includeActionButton: true,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const scannerPromptLayout = useMemo(() => {
    if (!position) return null;
    return layoutScannerPrompt({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      message: FORKINATOR_SCANNER_NUDGE_MESSAGE,
      includeCameraButton: true,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const handleScannerCameraPress = useCallback(() => {
    setScannerPromptVisible(false);
    markForkinatorScannerNudgeShown();
    if (!IS_WEB) {
      openPantryCameraScanFromForkinator();
      return;
    }
    if (!featureFlags.photoScan || !canSyncForkinatorWebCameraScan(photoScanAccess)) {
      openPantryScannerFromForkinator();
      return;
    }
    void (async () => {
      const file = await pickWebImageFile({ capture: 'environment' });
      if (!file) return;
      openPantryWithWebShelfScanFile(file);
    })();
  }, [featureFlags.photoScan, photoScanAccess]);

  const handleAisleSortPress = useCallback(() => {
    setAisleSortPromptVisible(false);
    markForkinatorAisleSortUsed();
    writeGroceryCombinePreference(true);
    requestGroceryAisleCombineView();
    if (!isGroceryScreen) {
      router.push(APP_ROUTES.grocery);
    }
  }, [isGroceryScreen]);

  const handleExpirationShowPress = useCallback(() => {
    const ids = expirationPromptItems.map((item) => item.id);
    setExpirationPromptVisible(false);
    openPantryExpiringHighlightFromForkinator(ids);
  }, [expirationPromptItems]);

  const handleRestockUndoPress = useCallback(() => {
    for (const target of restockUndoLines) {
      // FK3-6: remove exactly the row Forky added, by id (server id once saved). If a list
      // refresh dropped it from memory, removeGroceryItem still deletes it on the server.
      if (target.id) {
        removeGroceryItem(target.id);
        continue;
      }
      const normalized = target.name.trim().toLowerCase();
      const row = grocery.find(
        (item) =>
          !item.checked &&
          item.name.trim().toLowerCase() === normalized &&
          item.unit === target.unit,
      );
      if (row) removeGroceryItem(row.id);
    }
    setRestockUndoLines([]);
    setRestockPromptVisible(false);
  }, [grocery, removeGroceryItem, restockUndoLines]);

  const handleForkInRoadHelpPress = useCallback(() => {
    markForkInRoadPromptEngaged();
    setForkInRoadExpanded(false);
    setForkInRoadQuizVisible(true);
  }, []);

  const handleForkInRoadOpenRecipe = useCallback((row: RecipesTabRow) => {
    if (row.kind !== 'kitchen') return;
    router.push({ pathname: '/', params: { recipeId: row.recipe.id } });
  }, []);

  const handleMascotActivate = useCallback(() => {
    const action = resolveForkinatorMascotTapAction({
      greetingPromptVisible: greetingPromptVisibleRef.current,
      expirationPromptVisible: expirationPromptVisibleRef.current,
      restockPromptVisible: restockPromptVisibleRef.current,
      forkInRoadPromptVisible: forkInRoadPromptVisibleRef.current,
      forkInRoadExpanded,
      aisleSortPromptVisible: aisleSortPromptVisibleRef.current,
      scannerPromptVisible: scannerPromptVisibleRef.current,
    });
    if (action === 'dismissGreetingPrompt') {
      setGreetingPromptVisible(false);
      return;
    }
    if (action === 'dismissExpirationPrompt') {
      setExpirationPromptVisible(false);
      return;
    }
    if (action === 'dismissRestockPrompt') {
      setRestockPromptVisible(false);
      return;
    }
    if (action === 'collapseForkInRoadPrompt') {
      collapseForkInRoadPrompt();
      return;
    }
    if (action === 'dismissAisleSortPrompt') {
      setAisleSortPromptVisible(false);
      return;
    }
    if (action === 'dismissScannerPrompt') {
      setScannerPromptVisible(false);
      return;
    }
    // No active prompt: tapping Forky does nothing for now (the tap-for-a-tip bubble was
    // removed; it may come back later as a real tip).
  }, [collapseForkInRoadPrompt, forkInRoadExpanded]);

  const applyDragDelta = useCallback(
    (dx: number, dy: number) => {
      const base = dragOrigin.current;
      const next = clampForkinatorPosition({ x: base.x + dx, y: base.y + dy }, bounds);
      setDragPosition(next);
    },
    [bounds],
  );

  const finishInteraction = useCallback(
    (dx: number, dy: number, durationMs: number) => {
      const base = dragOrigin.current;
      const next = clampForkinatorPosition({ x: base.x + dx, y: base.y + dy }, bounds);
      dragOrigin.current = next;
      setDragPosition(next);
      if (!isForkinatorTapRelease(dx, dy, durationMs)) {
        writeForkinatorPosition(next);
      }

      if (isForkinatorTapRelease(dx, dy, durationMs)) {
        lastPointerActivateAtRef.current = Date.now();
        handleMascotActivate();
      }
    },
    [bounds, handleMascotActivate],
  );

  const panResponder = useMemo(() => {
    if (IS_WEB) {
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => false,
      });
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pressStartedAt.current = Date.now();
        const current =
          positionRef.current ?? defaultForkinatorPositionForTab(bounds, isHomeScreen);
        dragOrigin.current = current;
      },
      onPanResponderMove: (_event, gesture) => {
        applyDragDelta(gesture.dx, gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        const durationMs = Date.now() - pressStartedAt.current;
        finishInteraction(gesture.dx, gesture.dy, durationMs);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [applyDragDelta, bounds, finishInteraction, isHomeScreen]);

  const endPointerInteraction = useCallback(
    (track: PointerTrack, pageX: number, pageY: number) => {
      const dx = pageX - track.startPageX;
      const dy = pageY - track.startPageY;
      const durationMs = Date.now() - track.startedAt;
      finishInteraction(dx, dy, durationMs);
      pointerTrackRef.current = null;
    },
    [finishInteraction],
  );

  const onPointerDown: NonNullable<ViewProps['onPointerDown']> = useCallback((event) => {
    if (!IS_WEB) return;
    const native = event.nativeEvent;
    const pointerId = native.pointerId ?? 0;
    pressStartedAt.current = Date.now();
    const current =
      positionRef.current ?? defaultForkinatorPositionForTab(bounds, isHomeScreen);
    dragOrigin.current = current;
    pointerTrackRef.current = {
      pointerId,
      startPageX: native.pageX,
      startPageY: native.pageY,
      startedAt: Date.now(),
      maxDistance: 0,
    };
    const node = dragSurfaceRef.current as unknown as {
      setPointerCapture?: (id: number) => void;
    } | null;
    node?.setPointerCapture?.(pointerId);
    event.preventDefault();
  }, [bounds, isHomeScreen]);

  const onPointerMove: NonNullable<ViewProps['onPointerMove']> = useCallback((event) => {
    if (!IS_WEB) return;
    const track = pointerTrackRef.current;
    if (!track) return;
    const native = event.nativeEvent;
    if (native.pointerId !== track.pointerId) return;
    const dx = native.pageX - track.startPageX;
    const dy = native.pageY - track.startPageY;
    track.maxDistance = Math.max(track.maxDistance, Math.hypot(dx, dy));
    applyDragDelta(dx, dy);
    event.preventDefault();
  }, [applyDragDelta]);

  const onPointerUp: NonNullable<ViewProps['onPointerUp']> = useCallback((event) => {
    if (!IS_WEB) return;
    const track = pointerTrackRef.current;
    if (!track) return;
    const native = event.nativeEvent;
    if (native.pointerId !== track.pointerId) return;
    endPointerInteraction(track, native.pageX, native.pageY);
    event.preventDefault();
  }, [endPointerInteraction]);

  const onPointerCancel: NonNullable<ViewProps['onPointerCancel']> = useCallback((event) => {
    if (!IS_WEB) return;
    const track = pointerTrackRef.current;
    if (!track) return;
    endPointerInteraction(track, event.nativeEvent.pageX, event.nativeEvent.pageY);
  }, [endPointerInteraction]);

  const onKeyDown = useCallback(
    (event: { nativeEvent: { key: string }; preventDefault: () => void }) => {
      if (!IS_WEB) return;
      const key = event.nativeEvent.key;
      if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
      event.preventDefault();
      handleMascotActivate();
    },
    [handleMascotActivate],
  );

  const onWebClick = useCallback(
    (event: { preventDefault: () => void }) => {
      if (!IS_WEB) return;
      if (pointerTrackRef.current) return;
      const sincePointerActivate = Date.now() - lastPointerActivateAtRef.current;
      if (sincePointerActivate < FORKINATOR_WEB_POINTER_ACTIVATE_DEDUPE_MS) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      handleMascotActivate();
    },
    [handleMascotActivate],
  );

  if (!position || width <= 0 || height <= 0) return null;

  const webDragStyle = forkinatorDragSurfaceWebStyle();
  const imageWebStyle = forkinatorMascotImageWebStyle();
  const mascotPose = resolveForkinatorMascotPose({
    expirationPromptVisible,
    restockPromptVisible,
    forkInRoadPromptVisible,
    aisleSortPromptVisible,
    scannerPromptVisible,
    greetingPromptVisible,
  });
  const dragInteractionProps: ViewProps = IS_WEB
    ? ({
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onKeyDown,
        onClick: onWebClick,
        tabIndex: 0,
      } as ViewProps & { onClick?: typeof onWebClick; tabIndex?: number })
    : panResponder.panHandlers;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-0"
      style={{ zIndex: 100001 }}
    >
      {greetingPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={greetingPromptLayout}
          visible={greetingPromptVisible && forkinatorUiReady}
          reduceMotion={reduceMotion}
          message={FORKINATOR_GREETING_MESSAGE}
          accessibilityLabel={FORKINATOR_GREETING_A11Y_LABEL}
          onPress={() => setGreetingPromptVisible(false)}
        />
      ) : null}
      {restockPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={restockPromptLayout}
          visible={
            forkinatorUiReady &&
            restockPromptVisible &&
            !greetingPromptVisible &&
            !expirationPromptVisible
          }
          reduceMotion={reduceMotion}
          message={restockPromptMessage}
          accessibilityLabel={FORKINATOR_RESTOCK_PROMPT_A11Y_LABEL}
          onPress={() => setRestockPromptVisible(false)}
          actionButton={{
            label: FORKINATOR_RESTOCK_UNDO_BUTTON_LABEL,
            accessibilityLabel: FORKINATOR_RESTOCK_UNDO_BUTTON_A11Y_LABEL,
            onPress: handleRestockUndoPress,
          }}
        />
      ) : null}
      {expirationPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={expirationPromptLayout}
          visible={
            forkinatorUiReady &&
            expirationPromptVisible &&
            !greetingPromptVisible &&
            !restockPromptVisible &&
            !aisleSortPromptVisible &&
            !scannerPromptVisible &&
            !forkInRoadPromptVisible
          }
          reduceMotion={reduceMotion}
          message={expirationExpirationMessage}
          accessibilityLabel={FORKINATOR_EXPIRATION_PROMPT_A11Y_LABEL}
          onPress={() => setExpirationPromptVisible(false)}
          actionButton={{
            label: FORKINATOR_EXPIRATION_SHOW_BUTTON_LABEL,
            accessibilityLabel: FORKINATOR_EXPIRATION_SHOW_BUTTON_A11Y_LABEL,
            onPress: handleExpirationShowPress,
          }}
        />
      ) : null}
      {aisleSortPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={aisleSortPromptLayout}
          visible={
            forkinatorUiReady &&
            aisleSortPromptVisible &&
            !greetingPromptVisible &&
            !expirationPromptVisible &&
            !restockPromptVisible &&
            !scannerPromptVisible &&
            !forkInRoadPromptVisible
          }
          reduceMotion={reduceMotion}
          message={FORKINATOR_AISLE_SORT_MESSAGE}
          accessibilityLabel={FORKINATOR_AISLE_SORT_A11Y_LABEL}
          onPress={() => setAisleSortPromptVisible(false)}
          actionButton={{
            label: FORKINATOR_AISLE_SORT_BUTTON_LABEL,
            accessibilityLabel: FORKINATOR_AISLE_SORT_BUTTON_A11Y_LABEL,
            onPress: handleAisleSortPress,
          }}
        />
      ) : null}
      {forkInRoadPillLayout && forkInRoadCloudLayout ? (
        <ForkInRoadPrompt
          pillLayout={forkInRoadPillLayout}
          cloudLayout={forkInRoadCloudLayout}
          expanded={forkInRoadExpanded}
          visible={forkInRoadPromptVisible}
          reduceMotion={reduceMotion}
          onExpand={() => setForkInRoadExpanded(true)}
          onCollapse={collapseForkInRoadPrompt}
          onHelpPress={handleForkInRoadHelpPress}
        />
      ) : null}
      {scannerPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={scannerPromptLayout}
          visible={
            forkinatorUiReady &&
            scannerPromptVisible &&
            !greetingPromptVisible &&
            !expirationPromptVisible &&
            !restockPromptVisible &&
            !aisleSortPromptVisible &&
            !forkInRoadPromptVisible
          }
          reduceMotion={reduceMotion}
          message={FORKINATOR_SCANNER_NUDGE_MESSAGE}
          accessibilityLabel={FORKINATOR_SCANNER_NUDGE_A11Y_LABEL}
          onPress={() => {
            setScannerPromptVisible(false);
            openPantryScannerFromForkinator();
          }}
          actionButton={{
            label: FORKINATOR_SCANNER_CAMERA_BUTTON_LABEL,
            accessibilityLabel: FORKINATOR_SCANNER_CAMERA_BUTTON_A11Y_LABEL,
            onPress: handleScannerCameraPress,
            icon: 'camera',
          }}
        />
      ) : null}
      <ForkInRoadQuizSheet
        visible={forkInRoadQuizVisible}
        candidateRows={forkInRoadCandidateRows}
        onClose={() => setForkInRoadQuizVisible(false)}
        onOpenRecipe={handleForkInRoadOpenRecipe}
      />
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: FORKINATOR_WIDTH_PX,
          height: FORKINATOR_HEIGHT_PX,
        }}
      >
        {(Object.keys(FORKINATOR_MASCOT_POSE_SOURCES) as ForkinatorMascotPose[]).map((pose) => (
          <Image
            key={pose}
            source={FORKINATOR_MASCOT_POSE_SOURCES[pose]}
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                width: FORKINATOR_WIDTH_PX,
                height: FORKINATOR_HEIGHT_PX,
                opacity: pose === mascotPose ? 1 : 0,
              },
              imageWebStyle,
            ]}
            contentFit="contain"
            transition={0}
            accessibilityIgnoresInvertColors
            pointerEvents="none"
            onLoad={handleMascotImageLoad}
            {...(IS_WEB ? ({ draggable: false } as object) : null)}
          />
        ))}
        <View
          ref={dragSurfaceRef}
          {...dragInteractionProps}
          accessible
          accessibilityRole="button"
          accessibilityLabel={FORKINATOR_ACCESSIBILITY_LABEL}
          accessibilityHint={FORKINATOR_ACCESSIBILITY_HINT}
          focusable
          style={{
            position: 'absolute',
            left: FORKINATOR_HIT_INSET_LEFT_PX,
            top: FORKINATOR_HIT_INSET_TOP_PX,
            width: FORKINATOR_HIT_WIDTH_PX,
            height: FORKINATOR_HIT_HEIGHT_PX,
            ...webDragStyle,
          }}
        />
      </View>
    </View>
  );
}
