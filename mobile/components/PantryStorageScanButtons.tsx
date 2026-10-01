import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';
import { pantryStorageScanActions, type PantryStorageLocation } from '../config/pantryStorage';
import type { PreparedPantryImage } from '../lib/pantryVision/types';

export interface PantryStorageScanButtonsProps {
  disabled?: boolean;
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

  function openPickPhotoLocationMenu() {
    Alert.alert('Pick photo', 'Which storage area is this photo from?', [
      ...actions.map((action) => ({
        text: action.scanTitle,
        onPress: () => onRequestNativeScan(action.location, 'library'),
      })),
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
            className={`rounded-lg p-2 ${disabled ? 'opacity-40' : 'bg-emerald-light'}`}
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

      <Pressable
        disabled={disabled}
        onPress={() => openPickPhotoLocationMenu()}
        className={`mt-1 rounded-xl border border-border bg-paper px-3 py-3 ${disabled ? 'opacity-40' : ''}`}
      >
        <Text className="text-center text-sm font-bold text-slate">Pick photo…</Text>
      </Pressable>
    </View>
  );
}
