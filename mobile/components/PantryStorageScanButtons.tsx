import { Ionicons } from '../lib/icons/Ionicons';
import { Alert, Pressable, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';
import { PANTRY_SCAN_UI_COPY } from '../config/pantryScan';
import type { PantryPhotoScanGateInput } from '../lib/guest/pantryPhotoScanGate';
import type { PhotoScanAccessInput } from '../lib/plans/photoScanAccess';
import type { PreparedPantryImage } from '../lib/pantryVision/types';
import type { PantryStorageLocation } from '../config/pantryStorage';
import type { Session } from '@supabase/supabase-js';

export interface PantryStorageScanButtonsProps {
  disabled?: boolean;
  /** Web: block photo pickers and show guest sign-in prompt instead. */
  guestPhotoScanBlocked?: boolean;
  /** Web: session restore in progress — avoid treating signed-in users as guests. */
  authPhotoScanPending?: boolean;
  photoScanGate?: PantryPhotoScanGateInput;
  photoScanAccess?: PhotoScanAccessInput;
  contextSession?: Session | null;
  onPrepareError?: (message: string) => void;
  onImagePrepared: (location: PantryStorageLocation, prepared: PreparedPantryImage) => void;
  onRequestNativeScan: (location: PantryStorageLocation, source: 'camera' | 'library') => void;
  onRequestSignIn?: () => void;
  scanLocation: PantryStorageLocation;
}

export function PantryStorageScanButtons({
  disabled,
  onRequestNativeScan,
  scanLocation,
}: PantryStorageScanButtonsProps) {
  function openSourceMenu() {
    Alert.alert(PANTRY_SCAN_UI_COPY.choosePhotoSourceTitle, PANTRY_SCAN_UI_COPY.choosePhotoSourceMessage, [
      {
        text: PANTRY_SCAN_UI_COPY.takePhoto,
        onPress: () => onRequestNativeScan(scanLocation, 'camera'),
      },
      {
        text: PANTRY_SCAN_UI_COPY.chooseFromLibrary,
        onPress: () => onRequestNativeScan(scanLocation, 'library'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View className="mt-3">
      <Pressable
        disabled={disabled}
        onPress={openSourceMenu}
        className={`flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${
          disabled ? 'bg-slate/40' : 'bg-primary'
        }`}
        accessibilityLabel={PANTRY_SCAN_UI_COPY.scanShelfA11y}
      >
        <Ionicons name="camera-outline" size={22} color={THEME.onPrimary} />
        <Text className="text-sm font-bold text-on-primary">{PANTRY_SCAN_UI_COPY.scanShelf}</Text>
      </Pressable>
    </View>
  );
}
