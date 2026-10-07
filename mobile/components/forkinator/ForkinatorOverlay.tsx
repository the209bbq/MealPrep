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
  clampForkinatorPosition,
  defaultForkinatorPosition,
  FORKINATOR_HEIGHT_PX,
  FORKINATOR_WIDTH_PX,
  readForkinatorPosition,
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
import { isForkinatorTapRelease } from '../../lib/forkinator/tapGesture';
import { layoutThinkingBubble } from '../../lib/forkinator/thinkingBubbleLayout';
import {
  forkinatorDragSurfaceWebStyle,
  forkinatorMascotImageWebStyle,
} from '../../lib/forkinator/webTouchStyle';
import {
  resolveForkinatorMascotPose,
  type ForkinatorMascotPose,
} from '../../lib/forkinator/forkinatorPose';
import { ForkinatorScannerPrompt } from './ForkinatorScannerPrompt';
import { ForkinatorThinkingBubble } from './ForkinatorThinkingBubble';
import { ForkInRoadQuizSheet } from './ForkInRoadQuizSheet';
import {
  buildRestockReminderMessage,
  planStapleRestockLines,
  stapleDisplayNameForMessage,
} from '../../lib/forkinator/restockReminders';
import {
  consumeForkinatorRestockAfterCook,
  subscribeForkinatorRestockAfterCook,
} from '../../lib/forkinator/restockAfterCookEvent';
import {
  FORKINATOR_RESTOCK_PROMPT_A11Y_LABEL,
  FORKINATOR_RESTOCK_UNDO_BUTTON_A11Y_LABEL,
  FORKINATOR_RESTOCK_UNDO_BUTTON_LABEL,
} from '../../lib/forkinator/restockPromptCopy';
import {
  markForkInRoadPromptDismissed,
  markForkInRoadPromptEngaged,
  markForkInRoadPromptShown,
  shouldAutoShowForkInRoadPrompt,
} from '../../lib/forkinator/forkInRoadPrompt';
import {
  FORKINATOR_FORK_IN_ROAD_A11Y_LABEL,
  FORKINATOR_FORK_IN_ROAD_BUTTON_A11Y_LABEL,
  FORKINATOR_FORK_IN_ROAD_BUTTON_LABEL,
  FORKINATOR_FORK_IN_ROAD_MESSAGE,
} from '../../lib/forkinator/forkInRoadPromptCopy';
import { subscribeForkInRoadHomeIdleReady } from '../../lib/forkinator/forkInRoadIdle';
import { buildForkInRoadCandidateRows } from '../../lib/forkinator/forkInRoadQuiz';
import { filterRecipesTabRowsForDietPrefs } from '../../lib/diet/filterRows';
import { kitchenRecipesForPantryMatch } from '../../lib/recipeMatch/kitchenCatalogMerge';
import { readJson } from '../../lib/storage';
import type { ForkinatorAutoPromptKind } from '../../lib/forkinator/forkinatorActivePrompt';
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
  } = useApp();
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
  const [position, setPosition] = useState<ForkinatorPosition | null>(null);
  const [thinkingVisible, setThinkingVisible] = useState(false);
  const [greetingPromptVisible, setGreetingPromptVisible] = useState(false);
  const [scannerPromptVisible, setScannerPromptVisible] = useState(false);
  const [expirationPromptVisible, setExpirationPromptVisible] = useState(false);
  const [aisleSortPromptVisible, setAisleSortPromptVisible] = useState(false);
  const [restockPromptVisible, setRestockPromptVisible] = useState(false);
  const [restockPromptMessage, setRestockPromptMessage] = useState('');
  const [restockUndoLines, setRestockUndoLines] = useState<{ name: string; unit: string }[]>([]);
  const [forkInRoadPromptVisible, setForkInRoadPromptVisible] = useState(false);
  const [forkInRoadQuizVisible, setForkInRoadQuizVisible] = useState(false);
  const [expirationPromptItems, setExpirationPromptItems] = useState<PantryItem[]>([]);
  const positionRef = useRef<ForkinatorPosition | null>(null);
  const dragOrigin = useRef<ForkinatorPosition>({ x: 0, y: 0 });
  const pressStartedAt = useRef(0);
  const pointerTrackRef = useRef<PointerTrack | null>(null);
  const dragSurfaceRef = useRef<View>(null);
  const autoShowScheduledRef = useRef(false);
  const autoShowPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockScannerThisSessionRef = useRef(false);
  const greetingPromptVisibleRef = useRef(false);
  const scannerPromptVisibleRef = useRef(false);
  const expirationPromptVisibleRef = useRef(false);
  const aisleSortPromptVisibleRef = useRef(false);
  const restockPromptVisibleRef = useRef(false);
  const forkInRoadPromptVisibleRef = useRef(false);
  const sessionAutoPromptShownRef = useRef(false);
  const restockHandledForCookRef = useRef(false);
  const aisleCheckedOnPathRef = useRef(false);

  const showAutoPrompt = useCallback((kind: ForkinatorAutoPromptKind) => {
    setThinkingVisible(false);
    const setters: Record<ForkinatorAutoPromptKind, (v: boolean) => void> = {
      greeting: setGreetingPromptVisible,
      expiration: setExpirationPromptVisible,
      restock: setRestockPromptVisible,
      aisleSort: setAisleSortPromptVisible,
      scanner: setScannerPromptVisible,
      forkInRoad: setForkInRoadPromptVisible,
    };
    const setter = setters[kind];
    setGreetingPromptVisible(false);
    setExpirationPromptVisible(false);
    setRestockPromptVisible(false);
    setAisleSortPromptVisible(false);
    setScannerPromptVisible(false);
    setForkInRoadPromptVisible(false);
    setter(true);
    sessionAutoPromptShownRef.current = true;
  }, []);

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

  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    setPosition((current) => {
      if (current) return clampForkinatorPosition(current, bounds);
      const stored = readForkinatorPosition();
      return stored
        ? clampForkinatorPosition(stored, bounds)
        : defaultForkinatorPosition(bounds);
    });
  }, [bounds, height, width]);

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

  useEffect(() => {
    forkInRoadPromptVisibleRef.current = forkInRoadPromptVisible;
  }, [forkInRoadPromptVisible]);

  const openGroceryCount = useMemo(() => grocery.filter((item) => !item.checked).length, [grocery]);
  const groceryCombineByAisle = readGroceryCombinePreference();
  const showMealGrouping = hasMealPlanGroceryGrouping(mealPlan);
  const isGroceryScreen = pathname === '/grocery' || pathname.endsWith('/grocery');
  const isHomeScreen =
    pathname === '/' || pathname === '/index' || pathname.endsWith('/index');
  const expirationExpirationMessage = useMemo(
    () => buildForkinatorExpirationPromptMessage(expirationPromptItems),
    [expirationPromptItems],
  );

  useEffect(() => {
    if (!greetingPromptVisible) return;
    const timer = setTimeout(() => setGreetingPromptVisible(false), FORKINATOR_GREETING_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [greetingPromptVisible]);

  const mascotReady = position !== null && width > 0 && height > 0;

  useEffect(() => {
    if (!mascotReady || !kitchenPantryReady) return;
    if (autoShowScheduledRef.current) return;
    autoShowScheduledRef.current = true;

    const delay = FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS;

    if (!readForkinatorGreetingShown()) {
      blockScannerThisSessionRef.current = true;
      autoShowPromptTimerRef.current = setTimeout(() => {
        autoShowPromptTimerRef.current = null;
        markForkinatorGreetingShown();
        showAutoPrompt('greeting');
      }, FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS);
      return;
    }

    if (blockScannerThisSessionRef.current) return;

    const expirationPlan = shouldAutoShowForkinatorExpirationPrompt(pantry);
    if (expirationPlan.show) {
      autoShowPromptTimerRef.current = setTimeout(() => {
        autoShowPromptTimerRef.current = null;
        setExpirationPromptItems(expirationPlan.items);
        markForkinatorExpirationPromptShown(expirationPlan.items.map((item) => item.id));
        showAutoPrompt('expiration');
      }, delay);
      return;
    }

    if (!shouldAutoShowForkinatorScannerPrompt(readForkinatorHasScanned())) return;

    autoShowPromptTimerRef.current = setTimeout(() => {
      autoShowPromptTimerRef.current = null;
      if (blockScannerThisSessionRef.current) return;
      if (!shouldAutoShowForkinatorScannerPrompt(readForkinatorHasScanned())) return;
      markForkinatorScannerNudgeShown();
      showAutoPrompt('scanner');
    }, delay);
  }, [kitchenPantryReady, mascotReady, pantry, showAutoPrompt]);

  useEffect(() => {
    if (!isGroceryScreen) {
      aisleCheckedOnPathRef.current = false;
      return;
    }
    if (!mascotReady || !kitchenPantryReady) return;
    if (sessionAutoPromptShownRef.current) return;
    if (aisleCheckedOnPathRef.current) return;
    aisleCheckedOnPathRef.current = true;
    if (
      !shouldAutoShowForkinatorAisleSortPrompt({
        openGroceryItemCount: openGroceryCount,
        showMealGrouping,
        combineByAisle: groceryCombineByAisle,
      })
    ) {
      return;
    }
    markForkinatorAisleSortPromptShown();
    showAutoPrompt('aisleSort');
  }, [
    groceryCombineByAisle,
    isGroceryScreen,
    kitchenPantryReady,
    mascotReady,
    openGroceryCount,
    showMealGrouping,
    showAutoPrompt,
  ]);

  useEffect(() => {
    if (!greetingPromptVisible) return;
    setAisleSortPromptVisible(false);
    setScannerPromptVisible(false);
    setThinkingVisible(false);
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

    const lines = planStapleRestockLines(payload.nextPantry, grocery);
    if (lines.length === 0) return;

    for (const line of lines) {
      await addManualGroceryItem({
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        category: line.category,
      });
    }

    const messageNames = lines.map((line) => stapleDisplayNameForMessage(line.stapleId, line.name));
    setRestockUndoLines(lines.map((line) => ({ name: line.name, unit: line.unit })));
    setRestockPromptMessage(buildRestockReminderMessage(messageNames));
    showAutoPrompt('restock');
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

  const tryShowForkInRoadPrompt = useCallback(() => {
    if (!mascotReady || !isHomeScreen) return;
    if (greetingPromptVisibleRef.current) return;
    if (expirationPromptVisibleRef.current) return;
    if (restockPromptVisibleRef.current) return;
    if (aisleSortPromptVisibleRef.current) return;
    if (scannerPromptVisibleRef.current) return;
    if (forkInRoadPromptVisibleRef.current) return;
    if (!shouldAutoShowForkInRoadPrompt()) return;
    if (forkInRoadCandidateRows.length === 0) return;
    markForkInRoadPromptShown();
    showAutoPrompt('forkInRoad');
  }, [forkInRoadCandidateRows.length, isHomeScreen, mascotReady, showAutoPrompt]);

  useEffect(() => {
    return subscribeForkInRoadHomeIdleReady(() => {
      tryShowForkInRoadPrompt();
    });
  }, [tryShowForkInRoadPrompt]);

  const thinkingLayout = useMemo(() => {
    if (!position) return null;
    return layoutThinkingBubble({
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
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

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

  const forkInRoadPromptLayout = useMemo(() => {
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
    setForkInRoadPromptVisible(false);
    markForkInRoadPromptEngaged();
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
    if (action === 'dismissForkInRoadPrompt') {
      markForkInRoadPromptDismissed();
      setForkInRoadPromptVisible(false);
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
    setThinkingVisible((show) => !show);
  }, []);

  const applyDragDelta = useCallback(
    (dx: number, dy: number) => {
      const base = dragOrigin.current;
      const next = clampForkinatorPosition({ x: base.x + dx, y: base.y + dy }, bounds);
      setPosition(next);
    },
    [bounds],
  );

  const finishInteraction = useCallback(
    (dx: number, dy: number, durationMs: number) => {
      const base = dragOrigin.current;
      const next = clampForkinatorPosition({ x: base.x + dx, y: base.y + dy }, bounds);
      dragOrigin.current = next;
      setPosition(next);
      writeForkinatorPosition(next);

      if (isForkinatorTapRelease(dx, dy, durationMs)) {
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
        const current = positionRef.current ?? defaultForkinatorPosition(bounds);
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
  }, [applyDragDelta, bounds, finishInteraction]);

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
    const current = positionRef.current ?? defaultForkinatorPosition(bounds);
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
  }, [bounds]);

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

  if (!position || width <= 0 || height <= 0) return null;

  const webDragStyle = forkinatorDragSurfaceWebStyle();
  const imageWebStyle = forkinatorMascotImageWebStyle();
  const mascotPose = resolveForkinatorMascotPose({
    thinkingVisible,
    expirationPromptVisible,
    restockPromptVisible,
    forkInRoadPromptVisible,
    aisleSortPromptVisible,
    scannerPromptVisible,
    greetingPromptVisible,
  });
  const mascotSource = FORKINATOR_MASCOT_POSE_SOURCES[mascotPose];

  const onWebClick = useCallback(
    (event: { preventDefault: () => void }) => {
      if (!IS_WEB) return;
      const track = pointerTrackRef.current;
      if (track && track.maxDistance > 0) return;
      event.preventDefault();
      handleMascotActivate();
    },
    [handleMascotActivate],
  );

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
          visible={greetingPromptVisible}
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
            restockPromptVisible && !greetingPromptVisible && !expirationPromptVisible
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
      {forkInRoadPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={forkInRoadPromptLayout}
          visible={
            forkInRoadPromptVisible &&
            !greetingPromptVisible &&
            !expirationPromptVisible &&
            !restockPromptVisible &&
            !aisleSortPromptVisible &&
            !scannerPromptVisible
          }
          reduceMotion={reduceMotion}
          message={FORKINATOR_FORK_IN_ROAD_MESSAGE}
          accessibilityLabel={FORKINATOR_FORK_IN_ROAD_A11Y_LABEL}
          onPress={() => {
            markForkInRoadPromptDismissed();
            setForkInRoadPromptVisible(false);
          }}
          actionButton={{
            label: FORKINATOR_FORK_IN_ROAD_BUTTON_LABEL,
            accessibilityLabel: FORKINATOR_FORK_IN_ROAD_BUTTON_A11Y_LABEL,
            onPress: handleForkInRoadHelpPress,
          }}
        />
      ) : null}
      {scannerPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={scannerPromptLayout}
          visible={
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
      {thinkingLayout ? (
        <ForkinatorThinkingBubble
          layout={thinkingLayout}
          visible={thinkingVisible && !forkInRoadPromptVisible}
          reduceMotion={reduceMotion}
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
        <Image
          source={mascotSource}
          style={[
            { width: FORKINATOR_WIDTH_PX, height: FORKINATOR_HEIGHT_PX },
            imageWebStyle,
          ]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          pointerEvents="none"
          {...(IS_WEB ? ({ draggable: false } as object) : null)}
        />
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
