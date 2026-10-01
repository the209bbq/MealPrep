import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { APP_ROUTES } from '../config/appRoutes';
import { THEME } from '../config/appConfig';
import { GUEST_MODE_COPY } from '../config/guestMode';
import { pantryStorageScanActions, type PantryStorageLocation } from '../config/pantryStorage';
import { preparePantryImageFromFile } from '../lib/pantryVision/prepareImage.web';
import type { PantryStorageScanButtonsProps } from './PantryStorageScanButtons';

export function PantryStorageScanButtons({
  disabled,
  guestCameraBlocked,
  onImagePrepared,
}: PantryStorageScanButtonsProps) {
  const actions = pantryStorageScanActions();
  const [pickLocation, setPickLocation] = useState<PantryStorageLocation | null>(null);
  const [guestGateLocation, setGuestGateLocation] = useState<PantryStorageLocation | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

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
              if (guestCameraBlocked) {
                setGuestGateLocation(action.location);
                return;
              }
              setPickLocation(action.location);
              cameraRef.current?.click();
            }}
            className={`rounded-lg p-2 ${disabled ? 'opacity-40' : 'bg-primary-light'}`}
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

      {guestGateLocation ? (
        <View className="mb-2 rounded-2xl border border-primary bg-primary-light px-4 py-4">
          <Text className="text-sm font-bold text-ink">{GUEST_MODE_COPY.pantryScanSignInTitle}</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">{GUEST_MODE_COPY.pantryScanSignIn}</Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => router.push(APP_ROUTES.profile)}
              className="flex-1 items-center rounded-xl bg-primary py-3"
            >
              <Text className="text-sm font-bold text-on-primary">{GUEST_MODE_COPY.pantryScanSignInCta}</Text>
            </Pressable>
            <Pressable
              onPress={() => setGuestGateLocation(null)}
              className="items-center justify-center rounded-xl border border-border bg-paper px-4 py-3"
            >
              <Text className="text-sm font-semibold text-muted">Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
