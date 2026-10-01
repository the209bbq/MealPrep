import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';
import { pantryStorageScanActions, type PantryStorageLocation } from '../config/pantryStorage';
import type { PantryPhotoScanGateInput } from '../lib/guest/pantryPhotoScanGate';
import type { PreparedPantryImage } from '../lib/pantryVision/types';
import type { Session } from '@supabase/supabase-js';

export interface PantryStorageScanButtonsProps {
  disabled?: boolean;
  /** Web: block photo pickers and show guest sign-in prompt instead. */
  guestPhotoScanBlocked?: boolean;
  /** Web: session restore in progress — avoid treating signed-in users as guests. */
  authPhotoScanPending?: boolean;
  photoScanGate?: PantryPhotoScanGateInput;
  contextSession?: Session | null;
  onPrepareError?: (message: string) => void;
  onImagePrepared: (location: PantryStorageLocation, prepared: PreparedPantryImage) => void;
  onRequestNativeScan: (location: PantryStorageLocation, source: 'camera' | 'library') => void;
}

export function PantryStorageScanButtons({
  disabled,
  onRequestNativeScan,
}: PantryStorageScanButtonsProps) {
  const actions = pantryStorageScanActions();

  function openNativeSourceMenu(location: PantryStorageLocation, title: string) {
    Alert.alert(title, 'How do you want to add a photo?', [
      { text: 'Take photo', onPress: () => onRequestNativeScan(location, 'camera') },
      { text: 'Choose from library', onPress: () => onRequestNativeScan(location, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View className="mt-3">
      {actions.map((action) => (
        <View
          key={action.location}
          className="mb-2 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
        >
          <Ionicons
            name={action.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={THEME.primary}
          />
          <Text className="flex-1 text-sm font-bold text-ink">{action.scanTitle}</Text>
          <Pressable
            disabled={disabled}
            onPress={() => onRequestNativeScan(action.location, 'camera')}
            onLongPress={() => openNativeSourceMenu(action.location, action.scanTitle)}
            className={`rounded-lg p-2 ${disabled ? 'opacity-40' : 'bg-primary-light'}`}
            accessibilityLabel={`${action.scanTitle} with camera`}
          >
            <Ionicons name="camera-outline" size={20} color={THEME.primaryDark} />
          </Pressable>
          <Pressable
            disabled={disabled}
            onPress={() => onRequestNativeScan(action.location, 'library')}
            className={`rounded-lg border border-border p-2 ${disabled ? 'opacity-40' : 'bg-paper'}`}
            accessibilityLabel={`${action.scanTitle} from photo library`}
          >
            <Ionicons name="images-outline" size={20} color={THEME.primaryDark} />
          </Pressable>
        </View>
      ))}

    </View>
  );
}
