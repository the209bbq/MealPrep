import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCOUNT_SHEET_COPY, HOUSEHOLD_SIZE_LIMITS, LEGAL_LINKS } from '../../config/account';
import { APP_ROUTES } from '../../config/appRoutes';
import { ROLE_LABELS, THEME } from '../../config/appConfig';
import { USER_PREFERENCE_LABELS } from '../../config/userPreferences';
import { useApp } from '../../context/AppContext';
import { InstallAppBanner } from '../InstallAppBanner';
import { TourReplayCard } from '../onboarding/TourReplayCard';
import type { UserRole } from '../../types/mealprep';
import { AccountPlanSection } from './AccountPlanSection';
import { ProfileAvatar } from './ProfileAvatar';
import { pickProfilePhotoFromLibrary } from './pickProfilePhoto';

type AccountSheetProps = {
  visible: boolean;
  onClose: () => void;
};

function AccountSheetBody({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const {
    profile,
    demoMode,
    isAdmin,
    session,
    signOut,
    deleteAccount,
    setDemoRole,
    userPreferences,
    setUserPreference,
    onboarding,
    saveProfileSetup,
    uploadProfilePhoto,
    removeProfilePhoto,
    authError,
  } = useApp();

  const [name, setName] = useState(profile.name);
  const [zip, setZip] = useState(profile.homeZip ?? '');
  const [householdSize, setHouseholdSize] = useState(String(profile.householdSize));
  const [dietaryNotes, setDietaryNotes] = useState(profile.dietaryNotes);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function persistFields() {
    setBusy(true);
    setStatus(null);
    try {
      const size = Math.min(
        HOUSEHOLD_SIZE_LIMITS.max,
        Math.max(HOUSEHOLD_SIZE_LIMITS.min, Number.parseInt(householdSize, 10) || 2),
      );
      await saveProfileSetup({
        name: name.trim(),
        homeZip: zip.trim(),
        householdSize: size,
        dietaryNotes,
      });
      setStatus('Saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function onPickPhoto() {
    try {
      const prepared = await pickProfilePhotoFromLibrary();
      if (!prepared) return;
      await uploadProfilePhoto(prepared);
      setStatus('Photo updated.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not update photo.');
    }
  }

  function confirmDelete() {
    const runDelete = () => {
      void deleteAccount()
        .then(() => onClose())
        .catch((err: unknown) => {
          setStatus(err instanceof Error ? err.message : 'Delete failed.');
        });
    };

    if (Platform.OS === 'web') {
      const ok = window.confirm(
        `${ACCOUNT_SHEET_COPY.deleteAccountConfirmTitle}\n\n${ACCOUNT_SHEET_COPY.deleteAccountConfirmBody}`,
      );
      if (ok) runDelete();
      return;
    }

    Alert.alert(
      ACCOUNT_SHEET_COPY.deleteAccountConfirmTitle,
      ACCOUNT_SHEET_COPY.deleteAccountConfirmBody,
      [
        { text: ACCOUNT_SHEET_COPY.deleteAccountCancel, style: 'cancel' },
        { text: ACCOUNT_SHEET_COPY.deleteAccountConfirmAction, style: 'destructive', onPress: runDelete },
      ],
    );
  }

  const signedIn = demoMode || session != null;

  return (
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[94%] rounded-t-3xl bg-paper px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
          onPress={() => undefined}
        >
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink">{ACCOUNT_SHEET_COPY.accountTitle}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-sm font-bold text-muted">Close</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" className="pb-4">
            <View className="items-center py-2">
              <Pressable onPress={() => void onPickPhoto()} disabled={!signedIn}>
                <ProfileAvatar name={profile.name} photoUrl={profile.photoUrl} size={72} />
              </Pressable>
              {signedIn ? (
                <View className="mt-2 flex-row gap-3">
                  <Pressable onPress={() => void onPickPhoto()}>
                    <Text className="text-sm font-bold text-primary">{ACCOUNT_SHEET_COPY.changePhoto}</Text>
                  </Pressable>
                  {profile.photoUrl ? (
                    <Pressable
                      onPress={() =>
                        void removeProfilePhoto().then(() => setStatus('Photo removed.'))
                      }
                    >
                      <Text className="text-sm font-bold text-muted">{ACCOUNT_SHEET_COPY.removePhoto}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Text className="mt-2 text-lg font-bold text-ink">{profile.name}</Text>
              {profile.email ? <Text className="text-sm text-muted">{profile.email}</Text> : null}
              <Text className="mt-1 text-xs font-bold uppercase text-emerald">{ROLE_LABELS[profile.role]}</Text>
            </View>

            <AccountPlanSection plan={profile.plan} />

            {signedIn ? (
              <View className="mt-4 rounded-2xl border border-border bg-card px-4 py-3">
                <Text className="text-sm font-bold text-ink">Profile</Text>
                <Text className="mt-3 text-xs font-semibold text-muted">{ACCOUNT_SHEET_COPY.displayNameLabel}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="mt-1 rounded-xl border border-border bg-paper px-3 py-2 text-ink"
                  autoCapitalize="words"
                />
                <Text className="mt-3 text-xs font-semibold text-muted">{ACCOUNT_SHEET_COPY.homeZipLabel}</Text>
                <TextInput
                  value={zip}
                  onChangeText={setZip}
                  keyboardType="number-pad"
                  maxLength={10}
                  className="mt-1 rounded-xl border border-border bg-paper px-3 py-2 text-ink"
                />
                <Text className="mt-3 text-xs font-semibold text-muted">{ACCOUNT_SHEET_COPY.householdLabel}</Text>
                <TextInput
                  value={householdSize}
                  onChangeText={setHouseholdSize}
                  keyboardType="number-pad"
                  className="mt-1 rounded-xl border border-border bg-paper px-3 py-2 text-ink"
                />
                <Text className="mt-3 text-xs font-semibold text-muted">{ACCOUNT_SHEET_COPY.dietaryNotesLabel}</Text>
                <TextInput
                  value={dietaryNotes}
                  onChangeText={setDietaryNotes}
                  multiline
                  className="mt-1 min-h-[72px] rounded-xl border border-border bg-paper px-3 py-2 text-ink"
                />
                <Pressable
                  disabled={busy}
                  onPress={() => void persistFields()}
                  className={`mt-4 rounded-xl bg-primary px-4 py-3 ${busy ? 'opacity-60' : ''}`}
                >
                  <Text className="text-center font-bold text-on-primary">Save profile</Text>
                </Pressable>
              </View>
            ) : null}

            <TourReplayCard onReplay={onboarding.requestTourReplay} className="mt-4" />

            <View className="mt-4 rounded-2xl border border-border bg-card px-4 py-3">
              <Text className="text-sm font-bold text-ink">Kitchen preferences</Text>
              {(Object.keys(USER_PREFERENCE_LABELS) as (keyof typeof USER_PREFERENCE_LABELS)[]).map((key) => (
                <View
                  key={key}
                  className="mb-3 mt-3 flex-row items-center justify-between gap-3 border-b border-border pb-3"
                >
                  <View className="flex-1">
                    <Text className="font-semibold text-ink">{USER_PREFERENCE_LABELS[key].title}</Text>
                    <Text className="text-xs text-muted">{USER_PREFERENCE_LABELS[key].blurb}</Text>
                  </View>
                  <Switch
                    value={userPreferences[key]}
                    onValueChange={(value) => setUserPreference(key, value)}
                    trackColor={{ true: THEME.primary, false: THEME.border }}
                  />
                </View>
              ))}
            </View>

            <InstallAppBanner />

            <View className="mt-4 flex-row flex-wrap gap-3">
              <Pressable onPress={() => void Linking.openURL(LEGAL_LINKS.privacy)}>
                <Text className="text-sm font-bold text-primary">Privacy</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL(LEGAL_LINKS.terms)}>
                <Text className="text-sm font-bold text-primary">Terms</Text>
              </Pressable>
            </View>

            {isAdmin && !demoMode ? (
              <Pressable
                onPress={() => {
                  onClose();
                  router.push(APP_ROUTES.admin);
                }}
                className="mt-4 rounded-xl border border-border bg-card px-4 py-3"
              >
                <Text className="text-center font-bold text-slate">{ACCOUNT_SHEET_COPY.adminEntryLabel}</Text>
              </Pressable>
            ) : null}

            {demoMode ? (
              <View className="mt-4 rounded-2xl border border-border bg-card px-4 py-3">
                <Text className="font-bold text-ink">Demo mode</Text>
                <View className="mt-3 flex-row gap-2">
                  {(['admin', 'member'] as UserRole[]).map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => setDemoRole(role)}
                      className={`flex-1 rounded-xl px-3 py-3 ${profile.role === role ? 'bg-emerald' : 'border border-border bg-paper'}`}
                    >
                      <Text
                        className={`text-center text-sm font-bold ${profile.role === role ? 'text-on-emerald' : 'text-muted'}`}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : signedIn && !demoMode ? (
              <>
                <Pressable
                  onPress={() => void signOut().then(() => onClose())}
                  className="mt-4 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <Text className="text-center font-bold text-slate">{ACCOUNT_SHEET_COPY.signOut}</Text>
                </Pressable>
                <Pressable onPress={confirmDelete} className="mt-3 rounded-xl border border-danger/40 px-4 py-3">
                  <Text className="text-center font-bold text-danger">{ACCOUNT_SHEET_COPY.deleteAccount}</Text>
                </Pressable>
              </>
            ) : null}

            {status ? <Text className="mt-3 text-sm text-emerald-dark">{status}</Text> : null}
            {authError ? <Text className="mt-2 text-sm text-danger">{authError}</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
  );
}

export function AccountSheet({ visible, onClose }: AccountSheetProps) {
  const { profile } = useApp();
  if (!visible) return null;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <AccountSheetBody key={profile.id || 'guest'} onClose={onClose} />
    </Modal>
  );
}
