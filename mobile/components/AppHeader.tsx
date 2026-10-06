import { usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { HydrationSafeIonicon } from './HydrationSafeIonicon';
import { ACCOUNT_HEADER_COPY, APP_ROUTES } from '../config/appRoutes';
import { TABS, THEME } from '../config/appConfig';
import { HOME_HUB_COPY } from '../config/homeHub';
import { useApp } from '../context/AppContext';
import { useHomeHubSheet } from '../context/HomeHubSheetContext';
import { useHydrated } from '../hooks/useHydrated';
import { ProfileAvatar } from './account/ProfileAvatar';

export function AppHeader() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { profile, session, demoMode, openAuthSheet, openAccountSheet } = useApp();
  const { openHub } = useHomeHubSheet();
  const tab = TABS.find((t) => t.href === pathname || (pathname === '/' && t.name === 'index'));
  const title = tab?.title ?? 'Home';
  const signedIn = demoMode || session != null;
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
          accessibilityLabel={
            signedIn
              ? ACCOUNT_HEADER_COPY.avatarAccessibilityLabelSignedIn
              : ACCOUNT_HEADER_COPY.avatarAccessibilityLabelGuest
          }
          onPress={signedIn ? openAccountSheet : openAuthSheet}
          className="shrink-0"
        >
          {hydrated ? (
            <ProfileAvatar
              name={profile.name}
              photoUrl={profile.photoUrl}
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
