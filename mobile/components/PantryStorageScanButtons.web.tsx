import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { APP_ROUTES } from '../config/appRoutes';
import { THEME } from '../config/appConfig';
import { GUEST_MODE_COPY } from '../config/guestMode';
import { resolvePhotoScanSession } from '../lib/guest/resolvePhotoScanSession';
import { pantryStorageScanActions, type PantryStorageLocation } from '../config/pantryStorage';
import { PantryImageQualityError } from '../lib/pantryVision/prepareImageShared';
import { preparePantryImageFromFile } from '../lib/pantryVision/prepareImage.web';
import { pickWebImageFile } from '../lib/web/pickWebImageFile';
import type { PantryStorageScanButtonsProps } from './PantryStorageScanButtons';

export function PantryStorageScanButtons({
  disabled,
  guestPhotoScanBlocked,
  authPhotoScanPending,
  onPrepareError,
  onImagePrepared,
  photoScanGate,
  contextSession,
}: PantryStorageScanButtonsProps) {
  const actions = pantryStorageScanActions();
  const [guestGateLocation, setGuestGateLocation] = useState<PantryStorageLocation | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);

  const pickersDisabled = Boolean(disabled || pickerBusy);

  async function onPressPicker(location: PantryStorageLocation, source: 'camera' | 'library') {
    if (disabled) return;

    if (photoScanGate) {
      const resolved = await resolvePhotoScanSession(photoScanGate, contextSession ?? null);
      if (resolved.gate === 'auth_loading') {
        onPrepareError?.(GUEST_MODE_COPY.pantryScanAuthLoading);
        return;
      }
      if (resolved.gate === 'guest_blocked') {
        setGuestGateLocation(location);
        return;
      }
    } else if (authPhotoScanPending) {
      onPrepareError?.(GUEST_MODE_COPY.pantryScanAuthLoading);
      return;
    } else if (guestPhotoScanBlocked) {
      setGuestGateLocation(location);
      return;
    }

    setPickerBusy(true);
    try {
      const file = await pickWebImageFile(
        source === 'camera' ? { capture: 'environment' } : undefined,
      );
      if (!file) return;
      const prepared = await preparePantryImageFromFile(file);
      onImagePrepared(location, prepared);
    } catch (error: unknown) {
      const message =
        error instanceof PantryImageQualityError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not prepare photo';
      onPrepareError?.(message);
    } finally {
      setPickerBusy(false);
    }
  }

  return (
    <View className="mt-3">
      {authPhotoScanPending ? (
        <Text className="mb-2 text-xs text-muted">{GUEST_MODE_COPY.pantryScanAuthLoading}</Text>
      ) : null}

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
            disabled={pickersDisabled}
            onPress={() => void onPressPicker(action.location, 'camera')}
            className={`rounded-lg p-2 ${pickersDisabled ? 'opacity-40' : 'bg-primary-light'}`}
            accessibilityLabel={`${action.scanTitle} with camera`}
          >
            <Ionicons name="camera-outline" size={20} color={THEME.primaryDark} />
          </Pressable>
          <Pressable
            disabled={pickersDisabled}
            onPress={() => void onPressPicker(action.location, 'library')}
            className={`rounded-lg border border-border p-2 ${pickersDisabled ? 'opacity-40' : 'bg-paper'}`}
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
