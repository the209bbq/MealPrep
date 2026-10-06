import { Ionicons } from '../lib/icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';
import { GUEST_MODE_COPY } from '../config/guestMode';
import { PANTRY_SCAN_UI_COPY } from '../config/pantryScan';
import { resolvePhotoScanAccess } from '../lib/guest/resolvePhotoScanAccess';
import { resolvePhotoScanSession } from '../lib/guest/resolvePhotoScanSession';
import { photoScanAccessUserMessage } from '../lib/plans/photoScanAccess';
import { PantryImageQualityError } from '../lib/pantryVision/prepareImageShared';
import { pickWebImageFile } from '../lib/web/pickWebImageFile';
import { PhotoScanPlusUpgradeCard } from './PhotoScanPlusUpgradeCard';
import type { PantryStorageScanButtonsProps } from './PantryStorageScanButtons';

export function PantryStorageScanButtons({
  disabled,
  guestPhotoScanBlocked,
  authPhotoScanPending,
  onPrepareError,
  onImagePrepared,
  photoScanGate,
  photoScanAccess,
  contextSession,
  onRequestSignIn,
  scanLocation,
}: PantryStorageScanButtonsProps) {
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const [plusGateOpen, setPlusGateOpen] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);

  const pickersDisabled = Boolean(disabled || pickerBusy);

  async function runGateCheck(): Promise<boolean> {
    if (photoScanAccess) {
      const resolved = await resolvePhotoScanAccess(photoScanAccess, contextSession ?? null);
      if (resolved.access !== 'allowed') {
        const copy = photoScanAccessUserMessage(resolved.access);
        if (resolved.access === 'guest_blocked') {
          setGuestGateOpen(true);
          return false;
        }
        if (resolved.access === 'plan_blocked') {
          setPlusGateOpen(true);
          return false;
        }
        if (copy) {
          onPrepareError?.(copy.message);
        }
        return false;
      }
      return true;
    }
    if (photoScanGate) {
      const resolved = await resolvePhotoScanSession(photoScanGate, contextSession ?? null);
      if (resolved.gate === 'auth_loading') {
        onPrepareError?.(GUEST_MODE_COPY.pantryScanAuthLoading);
        return false;
      }
      if (resolved.gate === 'guest_blocked') {
        setGuestGateOpen(true);
        return false;
      }
      return true;
    }
    if (authPhotoScanPending) {
      onPrepareError?.(GUEST_MODE_COPY.pantryScanAuthLoading);
      return false;
    }
    if (guestPhotoScanBlocked) {
      setGuestGateOpen(true);
      return false;
    }
    return true;
  }

  async function onPressPicker(source: 'camera' | 'library') {
    setSourceMenuOpen(false);
    if (disabled) return;
    const allowed = await runGateCheck();
    if (!allowed) return;

    setPickerBusy(true);
    try {
      const file = await pickWebImageFile(
        source === 'camera' ? { capture: 'environment' } : undefined,
      );
      if (!file) return;
      const { preparePantryImageFromFile } = await import('../lib/pantryVision/prepareImage.web');
      const prepared = await preparePantryImageFromFile(file);
      onImagePrepared(scanLocation, prepared);
    } catch (error: unknown) {
      if (error instanceof PantryImageQualityError && error.reason === 'blank') {
        onPrepareError?.(error.message);
        return;
      }
      const message = error instanceof Error ? error.message : 'Could not prepare photo';
      onPrepareError?.(message);
    } finally {
      setPickerBusy(false);
    }
  }

  async function onPressScanShelf() {
    if (disabled) return;
    const allowed = await runGateCheck();
    if (!allowed) return;
    setSourceMenuOpen(true);
  }

  return (
    <View className="mt-3">
      {authPhotoScanPending ? (
        <Text className="mb-2 text-xs text-muted">{GUEST_MODE_COPY.pantryScanAuthLoading}</Text>
      ) : null}

      <Pressable
        disabled={pickersDisabled}
        onPress={() => void onPressScanShelf()}
        className={`flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${
          pickersDisabled ? 'bg-slate/40' : 'bg-primary'
        }`}
        accessibilityLabel={PANTRY_SCAN_UI_COPY.scanShelfA11y}
      >
        <Ionicons name="camera-outline" size={22} color={THEME.onPrimary} />
        <Text className="text-sm font-bold text-on-primary">{PANTRY_SCAN_UI_COPY.scanShelf}</Text>
      </Pressable>

      {sourceMenuOpen ? (
        <View className="mt-2 rounded-xl border border-border bg-card p-2">
          <Text className="mb-2 text-center text-xs font-semibold text-muted">
            {PANTRY_SCAN_UI_COPY.choosePhotoSourceMessage}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              disabled={pickersDisabled}
              onPress={() => void onPressPicker('camera')}
              className={`flex-1 rounded-lg py-2.5 ${pickersDisabled ? 'opacity-40' : 'bg-primary-light'}`}
              accessibilityLabel={PANTRY_SCAN_UI_COPY.takePhoto}
            >
              <Text className="text-center text-xs font-bold text-primary-dark">
                {PANTRY_SCAN_UI_COPY.takePhoto}
              </Text>
            </Pressable>
            <Pressable
              disabled={pickersDisabled}
              onPress={() => void onPressPicker('library')}
              className={`flex-1 rounded-lg border border-border py-2.5 ${pickersDisabled ? 'opacity-40' : 'bg-paper'}`}
              accessibilityLabel={PANTRY_SCAN_UI_COPY.chooseFromLibrary}
            >
              <Text className="text-center text-xs font-bold text-slate">
                {PANTRY_SCAN_UI_COPY.chooseFromLibrary}
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setSourceMenuOpen(false)} className="mt-2 py-1">
            <Text className="text-center text-xs font-semibold text-muted">Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {guestGateOpen ? (
        <View className="mb-2 mt-2 rounded-2xl border border-primary bg-primary-light px-4 py-4">
          <Text className="text-sm font-bold text-ink">{GUEST_MODE_COPY.pantryScanSignInTitle}</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">{GUEST_MODE_COPY.pantryScanSignIn}</Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => onRequestSignIn?.()}
              className="flex-1 items-center rounded-xl bg-primary py-3"
            >
              <Text className="text-sm font-bold text-on-primary">{GUEST_MODE_COPY.pantryScanSignInCta}</Text>
            </Pressable>
            <Pressable
              onPress={() => setGuestGateOpen(false)}
              className="items-center justify-center rounded-xl border border-border bg-paper px-4 py-3"
            >
              <Text className="text-sm font-semibold text-muted">Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {plusGateOpen ? <PhotoScanPlusUpgradeCard onDismiss={() => setPlusGateOpen(false)} /> : null}
    </View>
  );
}
