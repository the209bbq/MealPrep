import { usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { ACCOUNT_HEADER_COPY } from '../config/appRoutes';
import { TABS } from '../config/appConfig';
import { useApp } from '../context/AppContext';
import { ProfileAvatar } from './account/ProfileAvatar';

export function AppHeader() {
  const pathname = usePathname();
  const { profile, session, demoMode, openAuthSheet, openAccountSheet } = useApp();
  const tab = TABS.find((t) => t.href === pathname || (pathname === '/' && t.name === 'index'));
  const title = tab?.title ?? 'Home';
  const signedIn = demoMode || session != null;

  return (
    <View className="bg-slate px-4 pb-3 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
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
          <ProfileAvatar
            name={profile.name}
            photoUrl={profile.photoUrl}
            guest={!signedIn}
            size={36}
          />
        </Pressable>
      </View>
    </View>
  );
}
