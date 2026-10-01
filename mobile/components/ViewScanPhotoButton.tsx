import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text } from 'react-native';
import { SCAN_PHOTOS } from '../config/scanPhotos';
import { THEME } from '../config/appConfig';
import { createScanPhotoSignedUrl } from '../lib/scanPhotos/client';

type Props = {
  scanPhotoPath: string | null | undefined;
  className?: string;
};

export function ViewScanPhotoButton({ scanPhotoPath, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!scanPhotoPath?.trim()) return null;

  async function handlePress() {
    setLoading(true);
    setError(null);
    const url = await createScanPhotoSignedUrl(scanPhotoPath!);
    setLoading(false);
    if (!url) {
      setError(SCAN_PHOTOS.openPhotoFailed);
      return;
    }
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const opened = await Linking.openURL(url);
    if (!opened) {
      setError(SCAN_PHOTOS.openPhotoFailed);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => void handlePress()}
        disabled={loading}
        className={`mt-2 flex-row items-center gap-1 self-start ${className ?? ''}`}
        accessibilityRole="button"
        accessibilityLabel={SCAN_PHOTOS.viewPhotoLabel}
      >
        {loading ? (
          <ActivityIndicator size="small" color={THEME.emerald} />
        ) : (
          <Ionicons name="image-outline" size={16} color={THEME.emerald} />
        )}
        <Text className="text-xs font-bold text-emerald-dark">
          {loading ? SCAN_PHOTOS.loadingPhoto : SCAN_PHOTOS.viewPhotoLabel}
        </Text>
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-danger">{error}</Text> : null}
    </>
  );
}
