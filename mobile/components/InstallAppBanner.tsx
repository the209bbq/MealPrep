import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { APP_SHORT_NAME, THEME } from '../config/appConfig';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function InstallAppBanner() {
  const { showHint, canInstall, isIos, dismissInstallHint, promptInstall } = usePwaInstall();

  if (!showHint) return null;

  return (
    <View className="mb-3 rounded-2xl border border-emerald/30 bg-emerald-light px-4 py-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-emerald-dark">Install {APP_SHORT_NAME}</Text>
          {canInstall ? (
            <Text className="mt-1 text-xs text-emerald-dark">
              Add a home-screen shortcut for faster access and offline app shell loading.
            </Text>
          ) : isIos ? (
            <Text className="mt-1 text-xs text-emerald-dark">
              Tap Share in Safari, then &quot;Add to Home Screen&quot; to install.
            </Text>
          ) : null}
        </View>
        <Pressable onPress={dismissInstallHint} accessibilityLabel="Dismiss install hint" hitSlop={8}>
          <Ionicons name="close" size={20} color={THEME.emeraldDark} />
        </Pressable>
      </View>
      {canInstall ? (
        <Pressable
          onPress={() => promptInstall()}
          className="mt-3 items-center rounded-xl bg-emerald py-2.5"
        >
          <Text className="text-sm font-bold text-on-emerald">Install app</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
