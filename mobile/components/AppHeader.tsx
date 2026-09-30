import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { Text, View } from 'react-native';
import { APP_SHORT_NAME, ROLE_LABELS, TABS } from '../config/appConfig';
import { useApp } from '../context/AppContext';
import { initials } from '../lib/initials';

export function AppHeader() {
  const pathname = usePathname();
  const { profile } = useApp();
  const tab = TABS.find((t) => t.href === pathname || (pathname === '/' && t.name === 'index'));
  const title = tab?.title ?? APP_SHORT_NAME;

  return (
    <View className="bg-slate px-4 pb-3 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-emerald">
            <Ionicons name="nutrition" size={20} color="#ECFDF5" />
          </View>
          <View>
            <Text className="text-base font-bold text-on-emerald">{APP_SHORT_NAME}</Text>
            <Text className="text-xs font-semibold text-emerald-light">{title}</Text>
          </View>
        </View>
        <View className="items-end">
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
