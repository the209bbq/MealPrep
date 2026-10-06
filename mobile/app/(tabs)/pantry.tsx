import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '../../lib/icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHydrated } from '../../hooks/useHydrated';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../../components/Card';
import { CategoryChips } from '../../components/CategoryChips';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PantryFilteredItemList } from '../../components/PantryFilteredItemList';
import { PantryStorageScanButtons } from '../../components/PantryStorageScanButtons';
import { PantryScanReview, PantryScanReviewStickyFooter } from '../../components/PantryScanReview';
import { PantryOverflowMenu } from '../../components/PantryOverflowMenu';
import { PantryScanTip } from '../../components/PantryScanTip';
import {
  PantryStorageLocationChips,
  PantryStorageLocationFilterChips,
} from '../../components/PantryStorageLocationChips';
import { CATEGORY_LABELS, isPantryVisionConfigured, PHOTO_SCAN, THEME } from '../../config/appConfig';
import { GUEST_MODE_COPY } from '../../config/guestMode';
import { PANTRY_SCAN_UI_COPY, readLastPantryScanLocation } from '../../config/pantryScan';
import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  isPantryStorageLocation,
  labelForPantryStorageLocation,
  PANTRY_LOCATION_FILTER_STORAGE_KEY,
  PANTRY_STORAGE_LOCATIONS,
  previewResortFromDefaultPantry,
  suggestStorageLocationForCategory,
  suggestStorageLocationForPantryItem,
  type PantryStorageLocation,
} from '../../config/pantryStorage';
import { inferGroceryCategoryFromName } from '../../lib/grocery/categorize';
import { useApp } from '../../context/AppContext';
import { countDefaultKitchenMatches } from '../../config/recipeMatching';
import { buildPantryMatchIndex } from '../../lib/recipeMatch';
import {
  registerAiBaselineEntries,
  reviewItemsToPantryItems,
  mergeSecondScanIntoReview,
} from '../../lib/pantryVision/reviewItems';
import { buildScanCorrectionRows } from '../../lib/scanCorrections/diff';
import {
  logScanCorrectionsInBackground,
  uploadScanTrainingPhoto,
} from '../../lib/scanCorrections/client';
import { createScanSessionId } from '../../lib/scanCorrections/session';
import { countPantryItemsForLocationFilters, countPantryItemsInLocation } from '../../lib/pantryGrouping';
import { readJson, writeJson } from '../../lib/storage';
import { logPantryScanFailure } from '../../lib/pantryVision/scanLog';
import { PantryImageQualityError } from '../../lib/pantryVision/prepareImageShared';
import type { PantryScanReviewItem, PreparedPantryImage } from '../../lib/pantryVision/types';
import {
  shouldBlockGuestPantryPhotoScan,
  shouldDeferPantryPhotoScanForAuth,
} from '../../lib/guest/pantryPhotoScanGate';
import { resolvePhotoScanAccess } from '../../lib/guest/resolvePhotoScanAccess';
import { photoScanPlanBlockedMessage } from '../../lib/plans/photoScanPlanBlockedMessage';
import {
  photoScanAccessUserMessage,
  shouldDeferPhotoScanForProfile,
} from '../../lib/plans/photoScanAccess';
import { uploadScanPhoto } from '../../lib/scanPhotos/client';
import { TabEmptyState } from '../../components/TabEmptyState';
import { ViewScanPhotoButton } from '../../components/ViewScanPhotoButton';
import { PANTRY_CATEGORIES, type PantryCategory, type PantryItem } from '../../types/mealprep';
import { MAIN_INGREDIENT_COPY } from '../../config/mainIngredient';
import { APP_ROUTES } from '../../config/appRoutes';
import {
  PANTRY_STAPLES_COPY,
  readPantryStaplesPromptDismissed,
  writePantryStaplesPromptDismissed,
} from '../../config/pantryStaples';
import { PantryStaplesInviteCard } from '../../components/pantry/PantryStaplesInviteCard';
import { addDaysToIsoDate, todayIsoDate } from '../../lib/pantry/expiry';
import { STAPLE_EXPIRY_QUICK_CHIPS } from '../../lib/pantry/stapleCatalog';

type ScanPhase = 'idle' | 'loading' | 'review';

type PantryConfirmAction =
  | { kind: 'delete-item'; item: PantryItem }
  | { kind: 'clear-location'; location: PantryStorageLocation; count: number }
  | { kind: 'clear-all'; count: number }
  | { kind: 'resort'; toFridge: number; toSpiceRack: number };

function readStoredPantryLocationFilter(): PantryStorageLocation | 'all' {
  const saved = readJson<string | null>(PANTRY_LOCATION_FILTER_STORAGE_KEY, null);
  if (saved === 'all') return 'all';
  if (saved && isPantryStorageLocation(saved)) return saved;
  return 'all';
}

export default function PantryScreen() {
  const {
    pantry,
    recipes,
    featureFlags,
    demoMode,
    authReady,
    profile,
    profileReady,
    session,
    savePantryScanReview,
    userPreferences,
    setUserPreference,
    addManualPantryItem,
    updatePantryItemEntry,
    deletePantryItemEntry,
    clearPantryLocation,
    clearAllPantry,
    resortPantryItemsInDefaultLocation,
    openAuthSheet,
    isAdmin,
  } = useApp();
  const [filter, setFilter] = useState<PantryCategory | 'all'>('all');
  const hydrated = useHydrated();
  const [locationFilterOverride, setLocationFilterOverride] = useState<PantryStorageLocation | 'all' | null>(
    null,
  );
  const locationFilter: PantryStorageLocation | 'all' = hydrated
    ? (locationFilterOverride ?? readStoredPantryLocationFilter())
    : 'all';

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<PantryScanReviewItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanErrorTitle, setScanErrorTitle] = useState<string | null>(null);
  const [scanGuestSignInCta, setScanGuestSignInCta] = useState(false);
  const [scanNotice, setScanNotice] = useState<{ title: string; message: string } | null>(null);
  const [scanQualityWarning, setScanQualityWarning] = useState<string | null>(null);
  const [lastScanAttempt, setLastScanAttempt] = useState<
    | { kind: 'prepared'; prepared: PreparedPantryImage; location: PantryStorageLocation }
    | { kind: 'uri'; uri: string; location: PantryStorageLocation }
    | null
  >(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [addPhotoBusy, setAddPhotoBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('each');
  const [manualCategory, setManualCategory] = useState<PantryCategory>('produce');
  const [manualLocation, setManualLocation] = useState<PantryStorageLocation>(DEFAULT_PANTRY_STORAGE_LOCATION);
  const [confirmAction, setConfirmAction] = useState<PantryConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [manualExpiresOn, setManualExpiresOn] = useState<string | null>(null);
  const [manualExpiryInputOpen, setManualExpiryInputOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scanLocationHint, setScanLocationHint] = useState<PantryStorageLocation>(
    readLastPantryScanLocation(),
  );
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [staplesInviteDismissed, setStaplesInviteDismissed] = useState(() =>
    readPantryStaplesPromptDismissed(),
  );
  const [scanRecipeCount, setScanRecipeCount] = useState<number | null>(null);
  const [pendingScanPhotoPath, setPendingScanPhotoPath] = useState<string | null>(null);
  const pantryScanUploadRef = useRef<Promise<string | null> | null>(null);
  const scanSessionIdRef = useRef<string | null>(null);
  const aiBaselineRef = useRef<Map<string, { aiName: string }>>(new Map());

  const visionReady = isPantryVisionConfigured();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;

  const photoScanGate = useMemo(
    () => ({
      demoMode,
      authReady,
      hasSession: Boolean(session),
    }),
    [authReady, demoMode, session],
  );

  const photoScanAccess = useMemo(
    () => ({
      ...photoScanGate,
      plan: profile.plan,
      role: profile.role,
      profileReady,
    }),
    [photoScanGate, profile.plan, profile.role, profileReady],
  );

  const locationCounts = useMemo(
    () =>
      Object.fromEntries(
        PANTRY_STORAGE_LOCATIONS.map((location) => [location, countPantryItemsInLocation(pantry, location)]),
      ) as Record<PantryStorageLocation, number>,
    [pantry],
  );

  const locationFilterCounts = useMemo(
    () => countPantryItemsForLocationFilters(pantry, filter),
    [filter, pantry],
  );

  function selectLocationFilter(next: PantryStorageLocation | 'all') {
    setLocationFilterOverride(next);
    writeJson(PANTRY_LOCATION_FILTER_STORAGE_KEY, next);
  }

  const resortPreview = useMemo(() => previewResortFromDefaultPantry(pantry), [pantry]);

  function clearScanFailure() {
    setScanError(null);
    setScanErrorTitle(null);
    setScanGuestSignInCta(false);
    setScanNotice(null);
    setScanQualityWarning(null);
    setLastScanAttempt(null);
  }

  function setScanNoItemsFound(
    attempt:
      | { kind: 'prepared'; prepared: PreparedPantryImage; location: PantryStorageLocation }
      | { kind: 'uri'; uri: string; location: PantryStorageLocation },
  ) {
    setScanError(null);
    setScanErrorTitle(null);
    setScanNotice({
      title: PHOTO_SCAN.noItemsFoundTitle,
      message: PHOTO_SCAN.noItemsFoundMessage,
    });
    setLastScanAttempt(attempt);
  }

  function setScanFailure(
    message: string,
    title: string,
    attempt:
      | { kind: 'prepared'; prepared: PreparedPantryImage; location: PantryStorageLocation }
      | { kind: 'uri'; uri: string; location: PantryStorageLocation }
      | null,
    options?: { signInCta?: boolean },
  ) {
    setScanNotice(null);
    setScanError(message);
    setScanErrorTitle(title);
    setLastScanAttempt(attempt);
    setScanGuestSignInCta(Boolean(options?.signInCta));
  }

  function retryLastScan() {
    if (!lastScanAttempt) return;
    if (lastScanAttempt.kind === 'prepared') {
      void runVisionFromPrepared(lastScanAttempt.prepared, lastScanAttempt.location);
      return;
    }
    void runVisionFromUri(lastScanAttempt.uri, lastScanAttempt.location);
  }

  async function runVisionFromPrepared(
    prepared: PreparedPantryImage,
    scanLocation: PantryStorageLocation,
    options?: { mergeIntoReview?: boolean },
  ) {
    if (!featureFlags.photoScan) {
      const message = 'Photo pantry scan is turned off. An admin can re-enable it in feature toggles.';
      if (Platform.OS === 'web') {
        setScanFailure(message, 'Feature turned off', null);
      } else {
        Alert.alert('Feature turned off', message);
      }
      return;
    }
    const { access, session: scanSession } = await resolvePhotoScanAccess(photoScanAccess, session);
    if (access !== 'allowed') {
      const copy = photoScanAccessUserMessage(access);
      if (access === 'guest_blocked' && Platform.OS !== 'web') {
        promptGuestPhotoScanSignIn();
      }
      if (copy) {
        setScanFailure(copy.message, copy.title, null);
      }
      return;
    }

    const scanAccessToken = scanSession?.access_token ?? accessToken;
    const scanUserId = scanSession?.user?.id ?? userId;

    setScanLocationHint(scanLocation);
    clearScanFailure();
    setScanQualityWarning(prepared.qualityWarnings?.join(' ') ?? null);
    if (!options?.mergeIntoReview) {
      setPhase('loading');
      setPreviewUri(prepared.uri);
    } else {
      setAddPhotoBusy(true);
      setSaveError(null);
    }

    const attempt = { kind: 'prepared' as const, prepared, location: scanLocation };

    const pantryVisionClient = await import('../../lib/pantryVision/client');

    setPendingScanPhotoPath(null);
    if (scanUserId) {
      const uploadPromise = uploadScanPhoto(prepared, 'pantry', scanUserId);
      pantryScanUploadRef.current = uploadPromise;
      void uploadPromise.then(setPendingScanPhotoPath);
    } else {
      pantryScanUploadRef.current = null;
    }

    try {
      const { detectionsToReviewItems } = await import('../../lib/pantryVision/reviewItems');
      const result = await pantryVisionClient.analyzePantryPhoto(prepared, scanAccessToken, {
        scanLocation,
        bypassCache: options?.mergeIntoReview,
      });
      const rows = detectionsToReviewItems(
        result.items,
        pantry,
        recipes,
        prepared.uri,
        demoMode,
        scanLocation,
      );
      if (options?.mergeIntoReview) {
        if (rows.length === 0) {
          setSaveError(PANTRY_SCAN_UI_COPY.noNewItemsInPhoto);
        } else {
          setReviewItems((prev) => {
            const merged = mergeSecondScanIntoReview(prev, result.items, pantry, recipes, scanLocation);
            registerAiBaselineEntries(merged, aiBaselineRef.current);
            return merged;
          });
          setModelLabel(result.model);
          setPreviewUri(prepared.uri);
        }
        setLastScanAttempt(attempt);
        return;
      }
      if (rows.length === 0) {
        logPantryScanFailure('EMPTY_DETECTIONS');
        setScanNoItemsFound(attempt);
        setPhase('idle');
        return;
      }
      clearScanFailure();
      setLastScanAttempt(attempt);
      setModelLabel(result.model);
      scanSessionIdRef.current = createScanSessionId();
      aiBaselineRef.current = new Map();
      registerAiBaselineEntries(rows, aiBaselineRef.current);
      setReviewItems(rows);
      setPhase('review');
    } catch (error) {
      const {
        PantryVisionAuthError,
        PantryVisionNotConfiguredError,
        PantryVisionPlanRequiredError,
        PantryVisionRateLimitError,
        PantryVisionScanError,
      } = pantryVisionClient;
      const title =
        error instanceof PantryVisionRateLimitError
          ? 'Too many scans'
          : error instanceof PantryVisionAuthError
            ? 'Sign in required'
            : error instanceof PantryVisionPlanRequiredError
              ? photoScanPlanBlockedMessage().title
              : error instanceof PantryVisionNotConfiguredError
                ? 'Scan not set up'
                : PHOTO_SCAN.scanFailedTitle;
      const message =
        error instanceof PantryVisionNotConfiguredError
          ? error.message
          : error instanceof PantryVisionAuthError
            ? error.message
            : error instanceof PantryVisionPlanRequiredError
              ? error.message
              : error instanceof PantryVisionRateLimitError
                ? error.message
                : error instanceof PantryVisionScanError
                  ? error.message
                  : error instanceof Error
                    ? error.message
                    : PHOTO_SCAN.scanFailedMessage;
      const canRetry = !(error instanceof PantryVisionNotConfiguredError);
      if (options?.mergeIntoReview) {
        setSaveError(message);
      } else {
        setScanFailure(message, title, canRetry ? attempt : null);
        setPhase('idle');
      }
    } finally {
      if (options?.mergeIntoReview) {
        setAddPhotoBusy(false);
      }
    }
  }

  async function runVisionFromUri(uri: string, scanLocation: PantryStorageLocation) {
    clearScanFailure();
    setPhase('loading');
    setPreviewUri(uri);
    const attempt = { kind: 'uri' as const, uri, location: scanLocation };
    try {
      const { preparePantryImage } = await import('../../lib/pantryVision/prepareImage');
      const prepared = await preparePantryImage(uri);
      await runVisionFromPrepared(prepared, scanLocation);
    } catch (error) {
      if (error instanceof PantryImageQualityError && error.reason === 'blank') {
        logPantryScanFailure('BAD_IMAGE', error.message);
        setScanFailure(error.message, PHOTO_SCAN.scanFailedTitle, attempt);
      } else if (error instanceof Error) {
        logPantryScanFailure('BAD_IMAGE', error.message);
        setScanFailure(PHOTO_SCAN.scanFailedMessage, PHOTO_SCAN.scanFailedTitle, attempt);
      } else {
        logPantryScanFailure('UNKNOWN');
        setScanFailure(PHOTO_SCAN.scanFailedMessage, PHOTO_SCAN.scanFailedTitle, attempt);
      }
      setPhase('idle');
    }
  }

  async function handleAddAnotherPhotoFromReview() {
    const scanLocation = scanLocationHint;
    if (Platform.OS === 'web') {
      try {
        const { pickWebImageFile } = await import('../../lib/web/pickWebImageFile');
        const { preparePantryImageFromFile } = await import('../../lib/pantryVision/prepareImage.web');
        const file = await pickWebImageFile();
        if (!file) return;
        const prepared = await preparePantryImageFromFile(file);
        await runVisionFromPrepared(prepared, scanLocation, { mergeIntoReview: true });
      } catch (error) {
        if (error instanceof PantryImageQualityError && error.reason === 'blank') {
          setSaveError(error.message);
        } else {
          setSaveError(PHOTO_SCAN.scanFailedMessage);
        }
      }
      return;
    }
    Alert.alert(PANTRY_SCAN_UI_COPY.choosePhotoSourceTitle, PANTRY_SCAN_UI_COPY.choosePhotoSourceMessage, [
      {
        text: PANTRY_SCAN_UI_COPY.takePhoto,
        onPress: () => void pickNativePhotoAndMerge(scanLocation, 'camera'),
      },
      {
        text: PANTRY_SCAN_UI_COPY.chooseFromLibrary,
        onPress: () => void pickNativePhotoAndMerge(scanLocation, 'library'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickNativePhotoAndMerge(scanLocation: PantryStorageLocation, source: 'camera' | 'library') {
    const { access } = await resolvePhotoScanAccess(photoScanAccess, session);
    if (access !== 'allowed') {
      const copy = photoScanAccessUserMessage(access);
      if (copy) setSaveError(copy.message);
      return;
    }
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setSaveError(PHOTO_SCAN.cameraPermissionMessage);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: PHOTO_SCAN.jpegQuality,
      });
      if (result.canceled || !result.assets[0]) return;
      const { preparePantryImage } = await import('../../lib/pantryVision/prepareImage');
      const prepared = await preparePantryImage(result.assets[0].uri);
      await runVisionFromPrepared(prepared, scanLocation, { mergeIntoReview: true });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: PHOTO_SCAN.jpegQuality,
    });
    if (result.canceled || !result.assets[0]) return;
    const { preparePantryImage } = await import('../../lib/pantryVision/prepareImage');
    const prepared = await preparePantryImage(result.assets[0].uri);
    await runVisionFromPrepared(prepared, scanLocation, { mergeIntoReview: true });
  }

  function promptGuestPhotoScanSignIn() {
    setScanFailure(GUEST_MODE_COPY.pantryScanSignIn, GUEST_MODE_COPY.pantryScanSignInTitle, null, {
      signInCta: true,
    });
  }

  function handleWebPrepareError(message: string) {
    setScanFailure(message, PHOTO_SCAN.scanFailedTitle, null);
  }

  async function handleNativeScan(source: 'camera' | 'library') {
    const scanLocation = readLastPantryScanLocation();
    const { access } = await resolvePhotoScanAccess(photoScanAccess, session);
    if (access !== 'allowed') {
      const copy = photoScanAccessUserMessage(access);
      if (access === 'guest_blocked') {
        promptGuestPhotoScanSignIn();
        return;
      }
      if (copy) {
        setScanFailure(copy.message, copy.title, null);
      }
      return;
    }
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        if (Platform.OS === 'web') {
          setScanFailure(PHOTO_SCAN.cameraPermissionMessage, PHOTO_SCAN.scanFailedTitle, null);
        } else {
          Alert.alert('Camera', PHOTO_SCAN.cameraPermissionMessage);
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: PHOTO_SCAN.jpegQuality,
      });
      if (result.canceled || !result.assets[0]) return;
      await runVisionFromUri(result.assets[0].uri, scanLocation);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: PHOTO_SCAN.jpegQuality,
    });
    if (result.canceled || !result.assets[0]) return;
    await runVisionFromUri(result.assets[0].uri, scanLocation);
  }

  function submitScanCorrectionsFeedback() {
    if (demoMode || !session?.user?.id || !scanSessionIdRef.current) return;

    const scanId = scanSessionIdRef.current;
    const model = modelLabel;
    const baseline = aiBaselineRef.current;
    const finalItems = reviewItems;
    const shareTraining = userPreferences.shareScanPhotoForTraining;
    const prepared =
      lastScanAttempt?.kind === 'prepared' ? lastScanAttempt.prepared : null;
    const userId = session.user.id;

    const persist = (trainingPhotoPath: string | null) => {
      const rows = buildScanCorrectionRows({
        scanId,
        model,
        baseline,
        finalItems,
        trainingPhotoPath,
      });
      logScanCorrectionsInBackground(rows);
    };

    if (shareTraining && prepared) {
      void uploadScanTrainingPhoto(prepared, userId, scanId).then(persist);
    } else {
      persist(null);
    }
  }

  async function handleSaveReview() {
    setSaving(true);
    setSaveError(null);
    try {
      const mergedPantry = [...reviewItemsToPantryItems(reviewItems), ...pantry];
      const recipeCount = countDefaultKitchenMatches(
        buildPantryMatchIndex(recipes, mergedPantry).ranked,
        mergedPantry.length,
      );
      let scanPhotoPath = pendingScanPhotoPath;
      if (!scanPhotoPath && pantryScanUploadRef.current) {
        scanPhotoPath = await pantryScanUploadRef.current;
      }
      await savePantryScanReview(reviewItems, scanPhotoPath, scanLocationHint);
      submitScanCorrectionsFeedback();
      setPhase('idle');
      setReviewItems([]);
      setPreviewUri(null);
      setPendingScanPhotoPath(null);
      scanSessionIdRef.current = null;
      aiBaselineRef.current = new Map();
      clearScanFailure();
      setSaveError(null);
      setScanRecipeCount(recipeCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save pantry items';
      setSaveError(message);
      if (Platform.OS !== 'web') {
        Alert.alert('Save failed', message);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancelReview() {
    setPhase('idle');
    setReviewItems([]);
    setPreviewUri(null);
    setPendingScanPhotoPath(null);
    scanSessionIdRef.current = null;
    aiBaselineRef.current = new Map();
    setScanLocationHint(DEFAULT_PANTRY_STORAGE_LOCATION);
  }

  function resetManualForm() {
    setManualName('');
    setManualQty('1');
    setManualUnit('each');
    setManualCategory('produce');
    setManualLocation(suggestStorageLocationForCategory('produce'));
    setManualExpiresOn(null);
    setManualExpiryInputOpen(false);
  }

  function openAddModal() {
    resetManualForm();
    setEditItem(null);
    setAddOpen(true);
  }

  function cookWithPantryItem(item: PantryItem) {
    closeManualModal();
    router.push({
      pathname: '/recipes',
      params: { cookWith: encodeURIComponent(item.name.trim()) },
    });
  }

  function openEditModal(item: PantryItem) {
    setEditItem(item);
    setManualName(item.name);
    setManualQty(String(item.quantity));
    setManualUnit(item.unit);
    setManualCategory(item.category);
    setManualLocation(item.location);
    setManualExpiresOn(item.expiresOn);
    setManualExpiryInputOpen(Boolean(item.expiresOn));
    setAddOpen(true);
  }

  function openPantryStaples() {
    router.push(APP_ROUTES.pantryStaples);
  }

  function dismissStaplesInvite() {
    writePantryStaplesPromptDismissed(true);
    setStaplesInviteDismissed(true);
  }

  function closeManualModal() {
    setAddOpen(false);
    setEditItem(null);
    setFormError(null);
  }

  async function submitManualForm() {
    const qty = Number.parseFloat(manualQty);
    if (!manualName.trim()) {
      setFormError('Enter an item name.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Enter a valid quantity.');
      return;
    }
    setFormError(null);
    try {
      if (editItem) {
        await updatePantryItemEntry({
          ...editItem,
          name: manualName.trim(),
          quantity: qty,
          unit: manualUnit.trim() || 'each',
          category: manualCategory,
          location: manualLocation,
          expiresOn: manualExpiresOn,
        });
      } else {
        const trimmedName = manualName.trim();
        const inferredCategory = inferGroceryCategoryFromName(trimmedName);
        const inferredLocation = suggestStorageLocationForPantryItem(trimmedName, inferredCategory);
        await addManualPantryItem({
          name: trimmedName,
          quantity: qty,
          unit: manualUnit.trim() || 'each',
          category: inferredCategory,
          location: inferredLocation,
          expiresOn: manualExpiresOn,
        });
      }
      closeManualModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Try again.');
    }
  }

  function requestDeleteItem() {
    if (!editItem) return;
    setConfirmAction({ kind: 'delete-item', item: editItem });
  }

  async function runConfirmAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.kind === 'delete-item') {
        await deletePantryItemEntry(confirmAction.item.id);
        closeManualModal();
      } else if (confirmAction.kind === 'clear-location') {
        await clearPantryLocation(confirmAction.location);
      } else if (confirmAction.kind === 'resort') {
        await resortPantryItemsInDefaultLocation();
      } else {
        await clearAllPantry();
      }
      setConfirmAction(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Something went wrong.');
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const confirmCopy = useMemo(() => {
    if (!confirmAction) return null;
    if (confirmAction.kind === 'delete-item') {
      return {
        title: 'Delete item?',
        message: `Remove “${confirmAction.item.name}” from your pantry? This cannot be undone.`,
        confirmLabel: 'Delete item',
        destructive: true,
      };
    }
    if (confirmAction.kind === 'clear-location') {
      const label = labelForPantryStorageLocation(confirmAction.location);
      return {
        title: `Clear ${label}?`,
        message: `Remove all ${confirmAction.count} item(s) in ${label}? This cannot be undone.`,
        confirmLabel: `Clear ${label}`,
        destructive: true,
      };
    }
    if (confirmAction.kind === 'resort') {
      const parts: string[] = [];
      if (confirmAction.toFridge > 0) {
        parts.push(`${confirmAction.toFridge} to ${labelForPantryStorageLocation('fridge')}`);
      }
      if (confirmAction.toSpiceRack > 0) {
        parts.push(`${confirmAction.toSpiceRack} to ${labelForPantryStorageLocation('spice_rack')}`);
      }
      return {
        title: 'Re-sort items?',
        message: `Move ${parts.join(' and ')} from the default Pantry section. Items already in Fridge or Spice rack stay put.`,
        confirmLabel: 'Re-sort',
        destructive: false,
      };
    }
    return {
      title: 'Clear entire pantry?',
      message: `Remove all ${confirmAction.count} item(s) from every storage location? This cannot be undone.`,
      confirmLabel: 'Clear everything',
      destructive: true,
    };
  }, [confirmAction]);

  const reviewEnabledCount = useMemo(() => reviewItems.filter((i) => i.enabled).length, [reviewItems]);

  const showSetupHint = !visionReady && !demoMode;
  const scanControlsVisible = phase !== 'review';
  const showStaplesInvite = pantry.length === 0 && !staplesInviteDismissed && phase !== 'review';

  return (
    <>
      <View className="flex-1 bg-paper">
        <ScrollView className="flex-1 px-4 pb-8" contentContainerStyle={{ paddingBottom: phase === 'review' ? 96 : 32 }}>
        <View className="mt-4 flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">Pantry</Text>
            <Text className="text-sm text-muted">Track what you own — fewer duplicate buys</Text>
            <Pressable onPress={openPantryStaples} className="mt-2 self-start">
              <Text className="text-xs font-bold text-primary-dark">{PANTRY_STAPLES_COPY.addStaplesLink}</Text>
            </Pressable>
          </View>
          {pantry.length > 0 ? (
            <Pressable onPress={() => setOverflowOpen(true)} className="rounded-full border border-border bg-card p-2">
              <Ionicons name="ellipsis-horizontal" size={22} color={THEME.ink} />
            </Pressable>
          ) : null}
        </View>

        {showStaplesInvite ? (
          <PantryStaplesInviteCard onPick={openPantryStaples} onDismiss={dismissStaplesInvite} />
        ) : null}

        {scanRecipeCount != null && scanRecipeCount > 0 ? (
          <View className="mt-4 rounded-2xl border border-primary bg-primary-light px-4 py-4">
            <Text className="font-bold text-primary-dark">Pantry updated</Text>
            <Text className="mt-1 text-sm text-primary-dark">
              See {scanRecipeCount} recipe{scanRecipeCount === 1 ? '' : 's'} you can make with default matches.
            </Text>
            <Pressable
              onPress={() => {
                setScanRecipeCount(null);
                router.push('/recipes');
              }}
              className="mt-3 items-center rounded-xl bg-primary py-3"
            >
              <Text className="text-sm font-bold text-on-primary">See {scanRecipeCount} recipes</Text>
            </Pressable>
          </View>
        ) : null}

        <Card className="mt-4" title="Pantry inventory" subtitle="Filter by category or scan new items">
          {scanControlsVisible ? (
            <>
              <PantryStorageScanButtons
                disabled={phase === 'loading' || !featureFlags.photoScan}
                guestPhotoScanBlocked={shouldBlockGuestPantryPhotoScan(photoScanGate)}
                authPhotoScanPending={
                  shouldDeferPantryPhotoScanForAuth(photoScanGate) ||
                  shouldDeferPhotoScanForProfile(photoScanAccess)
                }
                photoScanGate={photoScanGate}
                photoScanAccess={photoScanAccess}
                contextSession={session}
                scanLocation={scanLocationHint}
                onPrepareError={handleWebPrepareError}
                onImagePrepared={(location, prepared) => {
                  setScanLocationHint(location);
                  void runVisionFromPrepared(prepared, location);
                }}
                onRequestNativeScan={(_location, source) => void handleNativeScan(source)}
                onRequestSignIn={openAuthSheet}
              />

              {featureFlags.photoScan ? <PantryScanTip className="mt-2" /> : null}
            </>
          ) : null}

          {phase === 'loading' ? (
            <View className="mt-4 items-center py-6">
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text className="mt-2 text-sm text-muted">Analyzing photo…</Text>
              <Text className="mt-2 max-w-sm text-center text-xs text-muted">
                {PHOTO_SCAN.analyzingPhotoMessage}
              </Text>
            </View>
          ) : null}

          {previewUri ? (
            <Image source={{ uri: previewUri }} className="mt-3 h-32 w-full rounded-xl" resizeMode="cover" />
          ) : null}

          {showSetupHint ? (
            <View className="mt-3 rounded-xl border border-border bg-paper p-3">
              <Text className="text-sm font-semibold text-ink">Photo scan not set up yet</Text>
              <Text className="mt-1 text-xs text-muted">{PHOTO_SCAN.notConfiguredMessage}</Text>
            </View>
          ) : null}

          {demoMode ? (
            <Text className="mt-2 text-xs text-muted">
              Demo mode: scan returns labeled sample detections only (no cloud scan).
            </Text>
          ) : null}

          {scanQualityWarning ? (
            <View className="mt-3 rounded-xl border border-border bg-paper p-3">
              <Text className="text-xs text-muted">{scanQualityWarning}</Text>
            </View>
          ) : null}

          {scanNotice ? (
            <View className="mt-3 rounded-xl border border-border bg-paper p-3">
              <Text className="text-sm font-bold text-ink">{scanNotice.title}</Text>
              <Text className="mt-1 text-xs text-muted">{scanNotice.message}</Text>
              {lastScanAttempt ? (
                <Pressable
                  onPress={retryLastScan}
                  className="mt-3 items-center rounded-xl border border-border bg-card py-2.5"
                >
                  <Text className="text-sm font-bold text-primary-dark">{PHOTO_SCAN.tryAgainLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {scanError ? (
            <View className="mt-3 rounded-xl border border-danger/25 bg-paper p-3">
              <Text className="text-sm font-bold text-ink">{scanErrorTitle ?? PHOTO_SCAN.scanFailedTitle}</Text>
              <Text className="mt-1 text-xs text-muted">{scanError}</Text>
              {scanGuestSignInCta ? (
                <Pressable
                  onPress={openAuthSheet}
                  className="mt-3 items-center rounded-xl bg-primary py-2.5"
                >
                  <Text className="text-sm font-bold text-on-primary">{GUEST_MODE_COPY.pantryScanSignInCta}</Text>
                </Pressable>
              ) : null}
              {lastScanAttempt ? (
                <Pressable
                  onPress={retryLastScan}
                  className="mt-3 items-center rounded-xl border border-border bg-card py-2.5"
                >
                  <Text className="text-sm font-bold text-primary-dark">{PHOTO_SCAN.tryAgainLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {phase === 'review' ? (
            <PantryScanReview
              key={`${scanLocationHint}-${reviewItems.map((i) => i.key).join(',')}`}
              items={reviewItems}
              onChange={setReviewItems}
              onSave={() => void handleSaveReview()}
              onCancel={handleCancelReview}
              onAddAnotherPhoto={() => void handleAddAnotherPhotoFromReview()}
              addPhotoBusy={addPhotoBusy}
              saving={saving}
              modelLabel={isAdmin ? modelLabel : undefined}
              saveError={saveError}
              defaultBatchLocation={scanLocationHint}
              onBatchLocationChange={setScanLocationHint}
              stickyFooter
              pantry={pantry}
              recipes={recipes}
              scanLocationHint={scanLocationHint}
              shareTrainingPhoto={userPreferences.shareScanPhotoForTraining}
              onShareTrainingPhotoChange={(value) => setUserPreference('shareScanPhotoForTraining', value)}
            />
          ) : null}

          <Pressable
            onPress={openAddModal}
            className="mt-4 rounded-xl border border-border bg-card px-3 py-3"
          >
            <Text className="text-center text-sm font-bold text-primary-dark">Add item manually</Text>
          </Pressable>
        </Card>

        <PantryStorageLocationFilterChips
          selected={locationFilter}
          onSelect={selectLocationFilter}
          counts={locationFilterCounts}
        />

        <CategoryChips selected={filter} onSelect={setFilter} />

        {actionError ? <Text className="mb-2 text-xs font-semibold text-danger">{actionError}</Text> : null}

        {pantry.length === 0 ? (
          <TabEmptyState tab="pantry" />
        ) : (
          <PantryFilteredItemList
            items={pantry}
            categoryFilter={filter}
            locationFilter={locationFilter}
            onPressItem={openEditModal}
            onResetFilters={() => {
              selectLocationFilter('all');
              setFilter('all');
            }}
          />
        )}
        </ScrollView>

        {phase === 'review' ? (
          <PantryScanReviewStickyFooter
            saving={saving}
            enabledCount={reviewEnabledCount}
            onSave={() => void handleSaveReview()}
            onCancel={handleCancelReview}
          />
        ) : null}
      </View>

      <PantryOverflowMenu
        visible={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        resortPreviewTotal={resortPreview.total}
        onResort={() =>
          setConfirmAction({
            kind: 'resort',
            toFridge: resortPreview.toFridge,
            toSpiceRack: resortPreview.toSpiceRack,
          })
        }
        locationCounts={locationCounts}
        onClearLocation={(location, count) => setConfirmAction({ kind: 'clear-location', location, count })}
        totalCount={pantry.length}
        onClearAll={() => setConfirmAction({ kind: 'clear-all', count: pantry.length })}
      />

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={closeManualModal}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl border border-border bg-paper px-4 pb-8 pt-4">
            <Text className="text-lg font-bold text-ink">{editItem ? 'Edit item' : 'Add item'}</Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Item name"
              placeholderTextColor={THEME.muted}
              className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
            />
            <View className="mt-3 flex-row gap-2">
              <TextInput
                value={manualQty}
                onChangeText={setManualQty}
                keyboardType="decimal-pad"
                placeholder="Qty"
                placeholderTextColor={THEME.muted}
                className="w-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
              <TextInput
                value={manualUnit}
                onChangeText={setManualUnit}
                placeholder="Unit"
                placeholderTextColor={THEME.muted}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
            </View>
            <Text className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              {PANTRY_CATEGORIES.map((cat) => {
                const selected = manualCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setManualCategory(cat);
                      if (!editItem) {
                        setManualLocation(suggestStorageLocationForCategory(cat));
                      }
                    }}
                    className={`mr-2 rounded-full px-3 py-2 ${selected ? 'bg-primary' : 'border border-border bg-card'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-on-primary' : 'text-slate'}`}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="mt-4">
              <PantryStorageLocationChips
                selected={manualLocation}
                onSelect={setManualLocation}
              />
            </View>
            <Text className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Expiration</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {STAPLE_EXPIRY_QUICK_CHIPS.map((chip) => {
                const target = addDaysToIsoDate(todayIsoDate(), chip.days);
                const selected = manualExpiresOn === target;
                return (
                  <Pressable
                    key={chip.id}
                    onPress={() => {
                      setManualExpiresOn(target);
                      setManualExpiryInputOpen(false);
                    }}
                    className={`rounded-full px-3 py-2 ${selected ? 'bg-primary' : 'border border-border bg-card'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-on-primary' : 'text-slate'}`}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setManualExpiryInputOpen((open) => !open)}
                className={`rounded-full px-3 py-2 ${manualExpiryInputOpen ? 'bg-primary' : 'border border-border bg-card'}`}
              >
                <Text
                  className={`text-xs font-semibold ${manualExpiryInputOpen ? 'text-on-primary' : 'text-slate'}`}
                >
                  {PANTRY_STAPLES_COPY.pickDate}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setManualExpiresOn(null);
                  setManualExpiryInputOpen(false);
                }}
                className={`rounded-full px-3 py-2 ${manualExpiresOn === null ? 'bg-primary' : 'border border-border bg-card'}`}
              >
                <Text
                  className={`text-xs font-semibold ${manualExpiresOn === null ? 'text-on-primary' : 'text-slate'}`}
                >
                  No date
                </Text>
              </Pressable>
            </View>
            {manualExpiryInputOpen ? (
              <TextInput
                value={manualExpiresOn ?? ''}
                onChangeText={(text) => setManualExpiresOn(text.trim() || null)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={THEME.muted}
                autoCapitalize="none"
                className="mt-2 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
            ) : null}
            {editItem?.scanPhotoPath ? (
              <ViewScanPhotoButton scanPhotoPath={editItem.scanPhotoPath} />
            ) : null}
            {formError ? <Text className="mt-2 text-xs font-semibold text-danger">{formError}</Text> : null}
            {editItem ? (
              <>
                <Pressable
                  onPress={() => cookWithPantryItem(editItem)}
                  className="mt-4 rounded-2xl border border-primary/30 bg-primary-light py-3"
                  accessibilityRole="button"
                  accessibilityLabel={MAIN_INGREDIENT_COPY.cookWithThisAction}
                >
                  <Text className="text-center font-bold text-primary-dark">
                    {MAIN_INGREDIENT_COPY.cookWithThisAction}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={requestDeleteItem}
                  className="mt-3 rounded-2xl border border-danger/30 py-3"
                >
                  <Text className="text-center font-bold text-danger">Delete item</Text>
                </Pressable>
              </>
            ) : null}
            <View className="mt-6 flex-row gap-2">
              <Pressable onPress={closeManualModal} className="flex-1 rounded-2xl border border-border py-3">
                <Text className="text-center font-bold text-slate">Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void submitManualForm()} className="flex-1 rounded-2xl bg-primary py-3">
                <Text className="text-center font-bold text-on-primary">{editItem ? 'Save changes' : 'Add to pantry'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmAction !== null && confirmCopy !== null}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message ?? ''}
        confirmLabel={confirmCopy?.confirmLabel}
        destructive={confirmCopy?.destructive}
        loading={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
        onConfirm={() => void runConfirmAction()}
      />
    </>
  );
}
