import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCOUNT_SHEET_COPY, HOUSEHOLD_SIZE_LIMITS } from '../../config/account';
import { useApp } from '../../context/AppContext';
import { readSavedZip } from '../../lib/smartShop/storage';
import { localZipPlaceLabel } from '../../lib/stores/localZipTable';
import { ProfileAvatar } from './ProfileAvatar';
import { pickProfilePhotoFromLibrary } from './pickProfilePhoto';

type PostSignupProfileSheetProps = {
  visible: boolean;
  onDone: () => void;
};

function PostSignupProfileForm({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { profile, saveProfileSetup, uploadProfilePhoto, profileReady } = useApp();
  const [name, setName] = useState(profile.name);
  const [zip, setZip] = useState(profile.homeZip?.trim() || readSavedZip());
  const [householdSize, setHouseholdSize] = useState(String(profile.householdSize || 2));
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zipLabel = localZipPlaceLabel(zip);

  async function onPickPhoto() {
    setError(null);
    try {
      const prepared = await pickProfilePhotoFromLibrary();
      if (!prepared) return;
      setPhotoPreview(prepared.uri);
      if (profileReady) {
        const uploaded = await uploadProfilePhoto(prepared);
        setPhotoPreview(uploaded.photoUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update photo.');
    }
  }

  async function save(andClose: boolean) {
    setBusy(true);
    setError(null);
    try {
      const size = Math.min(
        HOUSEHOLD_SIZE_LIMITS.max,
        Math.max(HOUSEHOLD_SIZE_LIMITS.min, Number.parseInt(householdSize, 10) || 2),
      );
      await saveProfileSetup({ name: name.trim(), homeZip: zip.trim(), householdSize: size });
      if (andClose) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-2xl font-bold text-ink">{ACCOUNT_SHEET_COPY.postSignupTitle}</Text>
      <Text className="mt-2 text-sm text-muted">{ACCOUNT_SHEET_COPY.postSignupSubtitle}</Text>

      <Pressable onPress={() => void onPickPhoto()} className="mt-6 items-center">
        <ProfileAvatar name={name || profile.name} photoUrl={photoPreview} size={80} />
        <Text className="mt-2 text-sm font-bold text-primary">{ACCOUNT_SHEET_COPY.changePhoto}</Text>
      </Pressable>

      <Text className="mt-6 text-sm font-semibold text-ink">{ACCOUNT_SHEET_COPY.displayNameLabel}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        autoCapitalize="words"
      />

      <Text className="mt-4 text-sm font-semibold text-ink">{ACCOUNT_SHEET_COPY.homeZipLabel}</Text>
      <TextInput
        value={zip}
        onChangeText={setZip}
        keyboardType="number-pad"
        maxLength={10}
        className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        placeholder="ZIP"
      />
      {zipLabel ? <Text className="mt-1 text-xs text-muted">{zipLabel}</Text> : null}

      <Text className="mt-4 text-sm font-semibold text-ink">{ACCOUNT_SHEET_COPY.householdLabel}</Text>
      <TextInput
        value={householdSize}
        onChangeText={setHouseholdSize}
        keyboardType="number-pad"
        className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-ink"
      />

      {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}

      <Pressable
        disabled={busy}
        onPress={() => void save(true)}
        className={`mt-8 rounded-2xl bg-primary px-4 py-4 ${busy ? 'opacity-60' : ''}`}
      >
        <Text className="text-center text-base font-bold text-on-primary">
          {ACCOUNT_SHEET_COPY.postSignupSave}
        </Text>
      </Pressable>
      <Pressable disabled={busy} onPress={onDone} className="mt-3 py-3">
        <Text className="text-center text-base font-bold text-muted">{ACCOUNT_SHEET_COPY.postSignupSkip}</Text>
      </Pressable>
    </ScrollView>
  );
}

export function PostSignupProfileSheet({ visible, onDone }: PostSignupProfileSheetProps) {
  const { profile } = useApp();
  if (!visible) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <PostSignupProfileForm key={profile.id} onDone={onDone} />
    </Modal>
  );
}
