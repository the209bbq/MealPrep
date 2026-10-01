import { usePathname } from 'expo-router';
import { Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { ROLE_LABELS, TABS } from '../config/appConfig';
import { useApp } from '../context/AppContext';
import { initials } from '../lib/initials';

export function AppHeader() {
  const pathname = usePathname();
  const { profile } = useApp();
  const tab = TABS.find((t) => t.href === pathname || (pathname === '/' && t.name === 'index'));
  const title = tab?.title ?? 'Home';

  return (
    <View className="bg-slate px-4 pb-3 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-2">
          <BrandLogo variant="header" />
          <Text className="shrink text-xs font-semibold text-emerald-light" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View className="shrink-0 items-end">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-dark">
            <Text className="text-xs font-bold text-on-emerald">{initials(profile.name)}</Text>
          </View>
          <Text className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-light">
            {ROLE_LABELS[profile.role]}
          </Text>
        </View>
      </View>
    </View>
  );
}
