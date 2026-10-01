import { router, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { ROLE_LABELS, TABS } from '../config/appConfig';
import { APP_ROUTES, AUTH_HEADER_COPY } from '../config/appRoutes';
import { useApp } from '../context/AppContext';
import { initials } from '../lib/initials';

export function AppHeader() {
  const pathname = usePathname();
  const { profile, session, demoMode } = useApp();
  const tab = TABS.find((t) => t.href === pathname || (pathname === '/' && t.name === 'index'));
  const title = tab?.title ?? 'Home';
  const showAccountChrome = demoMode || session != null;

  return (
    <View className="bg-slate px-4 pb-3 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
          <BrandLogo variant="header" />
          <Text className="shrink text-xs font-semibold text-on-primary-muted" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View className="shrink-0 items-end">
          {showAccountChrome ? (
            <>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Text className="text-xs font-bold text-on-primary">{initials(profile.name)}</Text>
              </View>
              <Text className="mt-1 text-[10px] font-bold uppercase tracking-wide text-on-primary-muted">
                {ROLE_LABELS[profile.role]}
              </Text>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={AUTH_HEADER_COPY.signInAccessibilityLabel}
              onPress={() => router.push(APP_ROUTES.profile)}
              className="min-h-[36px] items-center justify-center rounded-full border border-on-primary-muted/40 px-3 py-1.5"
            >
              <Text className="text-xs font-bold text-on-primary">{AUTH_HEADER_COPY.signInLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
