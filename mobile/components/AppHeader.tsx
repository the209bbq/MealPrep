import { usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { HydrationSafeIonicon } from './HydrationSafeIonicon';
import { APP_ROUTES } from '../config/appRoutes';
import { TABS, THEME } from '../config/appConfig';
import { HOME_HUB_COPY } from '../config/homeHub';
import { readAccountKitchenCache } from '../lib/account/accountKitchenCache';
import { resolveAccountHeaderAccessibilityLabel } from '../lib/account/accountHeaderChrome';
import { hasLikelyStoredAuthSession } from '../lib/account/authBootstrap';
import { readLastAccountUserId } from '../lib/account/lastAccountUser';
import { useApp } from '../context/AppContext';
import { useHomeHubSheet } from '../context/HomeHubSheetContext';
import { useHydrated } from '../hooks/useHydrated';
import { ProfileAvatar } from './account/ProfileAvatar';

export function AppHeader() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { profile, session, demoMode, authReady, openAuthSheet, openAccountSheet } = useApp();
  const { openHub } = useHomeHubSheet();
  const tab = TABS.find((t) => t.href === pathname || (pathname === '/' && t.name === 'index'));
  const title = tab?.title ?? 'Home';
  const storedSessionHint = hydrated && !authReady && hasLikelyStoredAuthSession();
  const signedIn = demoMode || session != null || storedSessionHint;
  const bootstrapProfile =
    storedSessionHint && !session
      ? readAccountKitchenCache(readLastAccountUserId() ?? '')?.profile
      : null;
  const avatarName = bootstrapProfile?.name ?? profile.name;
  const avatarPhoto = bootstrapProfile?.photoUrl ?? profile.photoUrl;
  const accountChromeReady = demoMode || authReady;
  const avatarAccessibilityLabel = resolveAccountHeaderAccessibilityLabel({
    demoMode,
    hydrated,
    authReady,
    signedIn,
  });
  const onHome = pathname === APP_ROUTES.home || pathname === '/index';

  return (
    <View className="bg-slate px-4 pb-3 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
          {onHome ? (
            <Pressable
              onPress={() => openHub('weekPlan')}
              accessibilityRole="button"
              accessibilityLabel={HOME_HUB_COPY.openAccessibilityLabel}
              hitSlop={8}
              className="shrink-0 rounded-lg p-1.5"
              style={({ pressed }) => ({
                backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
              })}
            >
              <HydrationSafeIonicon name="book-outline" size={22} color={THEME.onPrimary} />
            </Pressable>
          ) : null}
          <BrandLogo variant="header" />
          <Text className="shrink text-xs font-semibold text-on-primary-muted" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={avatarAccessibilityLabel}
          onPress={signedIn ? openAccountSheet : openAuthSheet}
          className="shrink-0"
        >
          {hydrated && accountChromeReady ? (
            <ProfileAvatar
              name={avatarName}
              photoUrl={avatarPhoto}
              guest={!signedIn}
              size={36}
            />
          ) : (
            <View
              style={{ width: 36, height: 36, borderRadius: 18 }}
              className="border border-on-primary-muted/40 bg-slate"
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}
