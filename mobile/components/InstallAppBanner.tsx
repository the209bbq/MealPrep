import { Ionicons } from '../lib/icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { APP_SHORT_NAME, THEME } from '../config/appConfig';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function InstallAppBanner() {
  const { showHint, canInstall, isIos, dismissInstallHint, promptInstall } = usePwaInstall();

  if (!showHint) return null;

  return (
    <View className="mb-2 rounded-xl border border-primary/30 bg-primary-light px-3 py-2">
      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-xs font-bold text-primary-dark">Install {APP_SHORT_NAME}</Text>
          {canInstall ? (
            <Text className="mt-0.5 text-[11px] leading-4 text-primary-dark" numberOfLines={2}>
              Add a home-screen shortcut for faster access.
            </Text>
          ) : isIos ? (
            <Text className="mt-0.5 text-[11px] leading-4 text-primary-dark" numberOfLines={2}>
              Safari Share → Add to Home Screen.
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={dismissInstallHint}
          accessibilityRole="button"
          accessibilityLabel="Dismiss install hint"
          hitSlop={8}
          className="rounded-full p-1"
        >
          <Ionicons name="close" size={18} color={THEME.primaryDark} />
        </Pressable>
      </View>
      {canInstall ? (
        <Pressable
          onPress={() => promptInstall()}
          className="mt-2 items-center rounded-lg bg-primary py-2"
        >
          <Text className="text-xs font-bold text-on-primary">Install app</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
