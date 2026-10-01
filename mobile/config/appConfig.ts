import type {
  FeatureFlags,
  PantryCategory,
  TabConfig,
  ThemeTokens,
  UserRole,
} from '../types/mealprep';
import { SMART_SHOP_STORES } from './smartShop';

export const APP_NAME = '209 Meal Prep';
export const APP_SHORT_NAME = 'Meal Prep';
export const APP_TAGLINE = 'Save time, effort, and money — cook what you have, shop only what you need.';
export const APP_SCHEME = 'mealprep';

export const THEME: ThemeTokens = {
  cream: '#FAF7F2',
  paper: '#F4EFE6',
  sand: '#E8DCC8',
  ink: '#1C1917',
  muted: '#78716C',
  border: '#E7E0D6',
  slate: '#334155',
  slateMuted: '#64748B',
  emerald: '#047857',
  emeraldDark: '#065F46',
  emeraldLight: '#D1FAE5',
  emeraldAccent: '#059669',
  onEmerald: '#ECFDF5',
  card: '#FFFcf7',
  danger: '#B45309',
};

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
    title: 'Grocery List',
    href: '/grocery',
    icon: 'cart-outline',
    iconActive: 'cart',
  },
  {
    name: 'admin',
    title: 'Profile',
    href: '/admin',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
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
  cacheTtlMs: 10 * 60 * 1000,
  defaultPerPage: 10,
  proxyUrl: process.env.EXPO_PUBLIC_RECIPEAPI_PROXY_URL ?? '',
} as const;

import { RECIPE_MATCHING } from './recipeMatching';

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
  maxImageDimension: 1280,
  jpegQuality: 0.72,
  maxPayloadBytes: 2_000_000,
  /** Documented default for the Edge Function secret GEMINI_MODEL (not sent from the client). */
  defaultGeminiModel: 'gemini-2.5-flash',
  proxyUrl: process.env.EXPO_PUBLIC_PANTRY_VISION_URL ?? '',
  notConfiguredMessage:
    'Pantry photo scan is not set up yet. Deploy the pantry-vision Edge Function and add GEMINI_API_KEY in Supabase secrets.',
  rateLimitMessage: 'Too many scans — wait a minute and try again.',
  /** Max wait for saving reviewed scan items to Supabase (web/PWA). */
  saveTimeoutMs: 15_000,
  saveTimeoutMessage: 'Saving pantry items timed out. Check your connection and try again.',
} as const;

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

/** USDA FoodData Central (API key stays on Supabase Edge Function `usda-proxy`). */
export const USDA_PROXY = {
  enabled: true,
  functionName: 'usda-proxy',
  cacheTtlMs: 10 * 60 * 1000,
  /** PWA origin allowed by the Edge Function CORS policy. */
  githubPagesOrigin: 'https://the209bbq.github.io',
} as const;

export const isUsdaProxyConfigured = (): boolean =>
  USDA_PROXY.enabled && !isDemoMode();

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
    title: 'Batch meal-prep calculator',
    blurb: 'Scale recipe servings and portions from the Recipes tab.',
  },
  grocerySync: {
    title: 'Grocery aggregation',
    blurb: 'Build the grocery list from selected recipes minus pantry stock.',
  },
  smartShop: {
    title: 'Smart Shop deals',
    blurb: 'Compare prices at nearby stores from the Grocery List tab.',
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

/** USDA FoodData Central — direct fallback only (no repo secrets; prefer `usda-proxy`). */
export const USDA_FDC_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
export const USDA_FDC_FOOD_URL = 'https://api.nal.usda.gov/fdc/v1/food';
export const USDA_DEMO_API_KEY = 'DEMO_KEY';
export const USDA_SETTINGS_STORAGE_KEY = 'mealprep.usdaApiKey';
export const USDA_SEARCH_DATA_TYPE = 'Foundation,SR Legacy,Survey (FNDDS)';

export const isSupabaseConfigured = (): boolean =>
  SUPABASE_URL.trim().length > 0 && SUPABASE_ANON_KEY.trim().length > 0;

export const isDemoMode = (): boolean => !isSupabaseConfigured();
