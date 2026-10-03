import type {
  FeatureFlags,
  PantryCategory,
  TabConfig,
  UserRole,
} from '../types/mealprep';
import { APP_ROUTES } from './appRoutes';
import { SMART_SHOP_STORES } from './smartShop';
import appBrand from './appBrand.json';
import { RECIPE_IMPORT } from './recipeImport';

export { MEAL_CALENDAR } from './mealCalendar';
export { THEME } from './theme';

export const APP_NAME = appBrand.name;
export const APP_SHORT_NAME = appBrand.shortName;
export const APP_TAGLINE = 'Save time, effort, and money — cook what you have, shop only what you need.';
export const APP_SCHEME = 'mealprep';

export const TABS: TabConfig[] = [
  { name: 'index', title: 'Home', href: '/', icon: 'home-outline', iconActive: 'home' },
  {
    name: 'recipes',
    title: 'Recipes',
    href: '/recipes',
    icon: 'restaurant-outline',
    iconActive: 'restaurant',
  },
  { name: 'pantry', title: 'Pantry', href: '/pantry', icon: 'leaf-outline', iconActive: 'leaf' },
  {
    name: 'grocery',
    title: 'Grocery list',
    href: '/grocery',
    icon: 'cart-outline',
    iconActive: 'cart',
  },
  {
    name: 'admin',
    title: 'Admin',
    href: APP_ROUTES.admin,
    icon: 'shield-checkmark-outline',
    iconActive: 'shield-checkmark',
    adminOnly: true,
  },
];

export const FEATURE_FLAG_DEFAULTS: FeatureFlags = {
  photoScan: true,
  batchCalculator: true,
  grocerySync: true,
  smartShop: true,
  maintenanceMode: false,
};

/** Smart Shop / store pricing (no secrets in repo — use env + optional Supabase Edge Function). */
export const SMART_SHOP = {
  defaultRadiusMiles: SMART_SHOP_STORES.defaultRadiusMiles,
  maxSavedStores: SMART_SHOP_STORES.maxSavedStores,
  /** Optional override; default is `${SUPABASE_URL}/functions/v1/kroger-deals`. */
  krogerProxyUrl: process.env.EXPO_PUBLIC_KROGER_PROXY_URL ?? '',
} as const;

/** RecipeAPI.io discovery (secret stays on Supabase Edge Function `recipeapi-proxy`). */
export const RECIPE_DISCOVERY = {
  enabled: true,
  searchDebounceMs: 450,
  cacheTtlMs: 30 * 60 * 1000,
  defaultPerPage: 10,
  proxyUrl: process.env.EXPO_PUBLIC_RECIPEAPI_PROXY_URL ?? '',
} as const;

import { RECIPE_MATCHING } from './recipeMatching';
import {
  DEFAULT_GEMINI_VISION_FALLBACK_MODELS,
  DEFAULT_GEMINI_VISION_MODEL,
} from './geminiVision';

/** Recipes tab: pantry-ranked kitchen list + optional discover search. */
export const RECIPES_TAB = {
  /** Do not load discover/catalog results until the user searches or applies filters. */
  discoverRequiresActiveQuery: true,
  /** Default kitchen list hides recipes with zero pantry ingredient matches. */
  hideZeroPantryMatches: true,
  defaultMinPercent: RECIPE_MATCHING.defaultMinPercent,
  defaultMinMatchedCount: RECIPE_MATCHING.defaultMinMatchedCount,
} as const;

export const getRecipeApiProxyUrl = (): string => {
  const override = RECIPE_DISCOVERY.proxyUrl.trim();
  if (override) return override;
  const base = SUPABASE_URL.trim().replace(/\/$/, '');
  if (!base) return '';
  return `${base}/functions/v1/recipeapi-proxy`;
};

/** Pantry shelf photo recognition (Gemini key stays on Supabase Edge Function `pantry-vision`). */
export const PHOTO_SCAN = {
  enabled: true,
  /** Long edge sent to pantry-vision (native + web use the same rule). */
  maxImageDimension: 1600,
  jpegQuality: 0.82,
  maxPayloadBytes: 2_800_000,
  /** Quality hints before upload (analysis on a downsampled thumb, not the full upload). */
  qualityAnalysisLongEdge: 256,
  minMeanLuminance: 0.12,
  /** Soft blur hint — mean squared Laplacian on 0–1 luma (sharp phone photos are often ~0.03–0.08). */
  minLaplacianVariance: 0.008,
  /** Hard reject when the frame is uniform/blank. */
  minLuminanceStdDev: 0.01,
  blankLaplacianVariance: 1e-6,
  imageTooDarkMessage: 'This photo looks too dark. Turn on more light and try again.',
  imageTooBlurryMessage: 'This photo looks blurry. Hold steady and tap to focus, then try again.',
  imageBlankMessage: 'This photo looks blank. Try another picture with your pantry in frame.',
  /** Documented default for the Edge Function secret GEMINI_MODEL (not sent from the client). */
  defaultGeminiModel: DEFAULT_GEMINI_VISION_MODEL,
  /** Documented default fallback chain on the Edge Function (override via GEMINI_FALLBACK_MODELS secret). */
  defaultGeminiFallbackModels: DEFAULT_GEMINI_VISION_FALLBACK_MODELS,
  proxyUrl: process.env.EXPO_PUBLIC_PANTRY_VISION_URL ?? '',
  notConfiguredMessage:
    'Pantry photo scan is not available on this app yet. Ask an admin to finish setup.',
  rateLimitMessage: 'Too many scans — wait a minute and try again.',
  scanFailedTitle: 'Couldn’t read that photo',
  scanFailedMessage:
    'Something went wrong while analyzing your photo. Check your connection and try again.',
  analyzingPhotoMessage:
    'This may take a few moments while we identify your pantry items.',
  noItemsFoundTitle: 'No pantry items spotted',
  noItemsFoundMessage:
    'We didn’t spot any pantry items in that photo. Try a closer shot with labels facing the camera.',
  scanBusyMessage: 'Scanning is busy right now. Try again in a moment.',
  /** Client fetch timeout; keep above pantry-vision GEMINI_REQUEST_TOTAL_BUDGET_MS (~110s). */
  visionRequestTimeoutMs: 125_000,
  tryAgainLabel: 'Try again',
  /** Max wait for saving reviewed scan items to Supabase (web/PWA). */
  saveTimeoutMs: 15_000,
  saveTimeoutMessage: 'Saving pantry items timed out. Check your connection and try again.',
} as const;

export const getRecipeImportUrl = (): string => {
  const override = RECIPE_IMPORT.proxyUrl.trim();
  if (override) return override;
  const base = SUPABASE_URL.trim().replace(/\/$/, '');
  if (!base) return '';
  return `${base}/functions/v1/recipe-import`;
};

export const isRecipeImportConfigured = (): boolean =>
  RECIPE_IMPORT.enabled && (isDemoMode() || getRecipeImportUrl().length > 0);

export const getPantryVisionUrl = (): string => {
  const override = PHOTO_SCAN.proxyUrl.trim();
  if (override) return override;
  const base = SUPABASE_URL.trim().replace(/\/$/, '');
  if (!base) return '';
  return `${base}/functions/v1/pantry-vision`;
};

export const isPantryVisionConfigured = (): boolean =>
  PHOTO_SCAN.enabled && (isDemoMode() || getPantryVisionUrl().length > 0);

export const isRecipeDiscoveryConfigured = (): boolean =>
  RECIPE_DISCOVERY.enabled && (isDemoMode() || getRecipeApiProxyUrl().length > 0);

export const getKrogerProxyUrl = (): string => {
  const override = SMART_SHOP.krogerProxyUrl.trim();
  if (override) return override;
  const base = SUPABASE_URL.trim().replace(/\/$/, '');
  if (!base) return '';
  return `${base}/functions/v1/kroger-deals`;
};

export const FEATURE_FLAG_LABELS: Record<keyof FeatureFlags, { title: string; blurb: string }> = {
  photoScan: {
    title: 'Photo pantry scan',
    blurb: 'Camera or gallery flow on Pantry with Gemini vision via the pantry-vision Edge Function.',
  },
  batchCalculator: {
    title: 'Batch meal prep calculator',
    blurb: 'Scale recipe servings and portions from the Recipes tab.',
  },
  grocerySync: {
    title: 'Grocery aggregation',
    blurb: 'Build the grocery list from selected recipes minus pantry stock.',
  },
  smartShop: {
    title: 'Smart Shop deals',
    blurb: 'Compare prices at nearby stores from the grocery list tab.',
  },
  maintenanceMode: {
    title: 'Maintenance mode',
    blurb: 'Non-admins see a full-screen maintenance page. Admins keep working.',
  },
};

export const CATEGORY_LABELS: Record<PantryCategory, string> = {
  spices: 'Spices',
  meats: 'Meats',
  produce: 'Produce',
  dairy: 'Dairy',
  dry_goods: 'Dry goods',
  cookware: 'Cookware',
  frozen: 'Frozen',
  condiments: 'Condiments',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  member: 'Member',
};

export const DEMO_USERS: Record<UserRole, { id: string; email: string; name: string }> = {
  admin: {
    id: 'demo-admin',
    email: 'chef@209mealprep.local',
    name: 'Chef David',
  },
  member: {
    id: 'demo-member',
    email: 'cook@209mealprep.local',
    name: 'Home Cook',
  },
};

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = (): boolean =>
  SUPABASE_URL.trim().length > 0 && SUPABASE_ANON_KEY.trim().length > 0;

export const isDemoMode = (): boolean => !isSupabaseConfigured();
