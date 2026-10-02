import { Ionicons } from '../lib/icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { APP_SHORT_NAME, THEME } from '../config/appConfig';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function InstallAppBanner() {
  const { showHint, canInstall, isIos, dismissInstallHint, promptInstall } = usePwaInstall();

  if (!showHint) return null;

  return (
    <View className="mb-3 rounded-2xl border border-primary/30 bg-primary-light px-4 py-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-primary-dark">Install {APP_SHORT_NAME}</Text>
          {canInstall ? (
            <Text className="mt-1 text-xs text-primary-dark">
              Add a home-screen shortcut for faster access and offline app shell loading.
            </Text>
          ) : isIos ? (
            <Text className="mt-1 text-xs text-primary-dark">
              Tap Share in Safari, then &quot;Add to Home Screen&quot; to install.
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
          <Ionicons name="close" size={20} color={THEME.primaryDark} />
        </Pressable>
      </View>
      {canInstall ? (
        <Pressable
          onPress={() => promptInstall()}
          className="mt-3 items-center rounded-xl bg-primary py-2.5"
        >
          <Text className="text-sm font-bold text-on-primary">Install app</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
