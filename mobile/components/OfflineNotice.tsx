import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

export function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const sync = () => setOffline(!window.navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <View
      className="border-b border-border bg-sand px-3 py-1.5"
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Text className="text-center text-xs font-medium text-muted">You&apos;re offline — showing your last saved data</Text>
    </View>
  );
}
