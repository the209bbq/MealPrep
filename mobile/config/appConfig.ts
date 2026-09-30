import type {
  FeatureFlags,
  PantryCategory,
  TabConfig,
  ThemeTokens,
  UserRole,
} from '../types/mealprep';

export const APP_NAME = '209 Meal Prep';
export const APP_SHORT_NAME = 'Meal Prep';
export const APP_TAGLINE = 'Chef-crafted kitchen, ready when you are.';
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
  { name: 'pantry', title: 'Pantry', href: '/pantry', icon: 'leaf-outline', iconActive: 'leaf' },
  {
    name: 'recipes',
    title: 'Recipes',
    href: '/recipes',
    icon: 'restaurant-outline',
    iconActive: 'restaurant',
  },
  {
    name: 'grocery',
    title: 'Grocery List',
    href: '/grocery',
    icon: 'cart-outline',
    iconActive: 'cart',
  },
  {
    name: 'admin',
    title: 'Admin/Profile',
    href: '/admin',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
  },
];

export const FEATURE_FLAG_DEFAULTS: FeatureFlags = {
  photoScan: true,
  batchCalculator: true,
  grocerySync: true,
  maintenanceMode: false,
  recipeMasterEdit: true,
};

export const FEATURE_FLAG_LABELS: Record<keyof FeatureFlags, { title: string; blurb: string }> = {
  photoScan: {
    title: 'Photo pantry scan',
    blurb: 'Show the camera/image-picker flow on Pantry. Recognition is stubbed until an API is wired.',
  },
  batchCalculator: {
    title: 'Batch meal-prep calculator',
    blurb: 'Scale recipe servings and portions from the Recipes tab.',
  },
  grocerySync: {
    title: 'Grocery aggregation',
    blurb: 'Build the grocery list from selected recipes minus pantry stock.',
  },
  maintenanceMode: {
    title: 'Maintenance mode',
    blurb: 'Non-admins see a full-screen maintenance page. Admins keep working.',
  },
  recipeMasterEdit: {
    title: 'Recipe master table',
    blurb: 'Allow admins to edit the global recipe catalog.',
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
