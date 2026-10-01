import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';
import { pantryStorageScanActions, type PantryStorageLocation } from '../config/pantryStorage';
import { preparePantryImageFromFile } from '../lib/pantryVision/prepareImage.web';
import type { PantryStorageScanButtonsProps } from './PantryStorageScanButtons';

export function PantryStorageScanButtons({
  disabled,
  onImagePrepared,
}: PantryStorageScanButtonsProps) {
  const actions = pantryStorageScanActions();
  const [pickLocation, setPickLocation] = useState<PantryStorageLocation | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

  function openPickPhotoLocationMenu() {
    Alert.alert('Pick photo', 'Which storage area is this photo from?', [
      ...actions.map((action) => ({
        text: action.scanTitle,
        onPress: () => {
          setPickLocation(action.location);
          libraryRef.current?.click();
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const handleWebFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const location = pickLocation ?? actions[0]?.location ?? 'pantry';
    setPickLocation(null);
    if (!file) return;
    void preparePantryImageFromFile(file)
      .then((prepared) => onImagePrepared(location, prepared))
      .catch(() => {
        /* scan errors surface in pantry screen flow */
      });
  };

  return (
    <View className="mt-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleWebFile}
      />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={handleWebFile} />

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
            onPress={() => {
              setPickLocation(action.location);
              cameraRef.current?.click();
            }}
            className={`rounded-lg p-2 ${disabled ? 'opacity-40' : 'bg-emerald-light'}`}
            accessibilityLabel={`${action.scanTitle} with camera`}
          >
            <Ionicons name="camera-outline" size={20} color={THEME.primaryDark} />
          </Pressable>
          <Pressable
            disabled={disabled}
            onPress={() => {
              setPickLocation(action.location);
              libraryRef.current?.click();
            }}
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
