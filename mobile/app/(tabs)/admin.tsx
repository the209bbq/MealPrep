import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { BrandLogo } from '../../components/BrandLogo';
import { Card } from '../../components/Card';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { APP_BRAND } from '../../config/appBrand';
import { FEATURE_FLAG_LABELS, ROLE_LABELS, THEME, isDemoMode } from '../../config/appConfig';
import { USER_PREFERENCE_LABELS } from '../../config/userPreferences';
import { useApp } from '../../context/AppContext';
import { UsdaNutritionPanel } from '../../components/UsdaNutritionPanel';
import { initials } from '../../lib/initials';
import type { FeatureFlagKey, UserRole } from '../../types/mealprep';

export default function AdminScreen() {
  const {
    profile,
    isAdmin,
    demoMode,
    session,
    authReady,
    authError,
    setDemoRole,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signOut,
    featureFlags,
    setFeatureFlag,
    userPreferences,
    setUserPreference,
    seedPantry,
    analytics,
    recipes,
    updateRecipe,
  } = useApp();

  if (!demoMode && !session) {
    if (!authReady) {
      return (
        <ScrollView className="flex-1 bg-paper px-4 pb-8">
          <Card className="mt-4" title="Sign in" subtitle="Connecting…">
            <Text className="mt-2 text-sm text-muted">Loading authentication.</Text>
          </Card>
        </ScrollView>
      );
    }
    return (
      <ScrollView className="flex-1 bg-paper px-4 pb-8">
        <AuthPanel
          authError={authError}
          onSignIn={signInWithPassword}
          onSignUp={signUpWithPassword}
          onMagicLink={signInWithMagicLink}
        />
      </ScrollView>
    );
  }

  if (!isAdmin) {
    return (
      <ScrollView className="flex-1 bg-paper px-4 pb-8">
        <Card className="mt-4 items-center" title="Your profile">
          <View className="mt-4 h-16 w-16 items-center justify-center rounded-full bg-emerald-light">
            <Text className="text-xl font-bold text-emerald-dark">{initials(profile.name)}</Text>
          </View>
          <Text className="mt-3 text-xl font-bold text-ink">{profile.name}</Text>
          <Text className="text-sm text-muted">{profile.email}</Text>
          <Text className="mt-1 text-xs font-bold uppercase text-emerald">{ROLE_LABELS[profile.role]}</Text>
          <Text className="mt-4 text-sm text-muted">Household: {profile.householdSize}</Text>
          <Text className="mt-1 text-sm text-muted">{profile.dietaryNotes}</Text>
        </Card>
        <Card className="mt-4" title="Kitchen preferences">
          {(Object.keys(USER_PREFERENCE_LABELS) as (keyof typeof USER_PREFERENCE_LABELS)[]).map((key) => (
            <View key={key} className="mb-3 flex-row items-center justify-between gap-3 border-b border-border pb-3">
              <View className="flex-1">
                <Text className="font-semibold text-ink">{USER_PREFERENCE_LABELS[key].title}</Text>
                <Text className="text-xs text-muted">{USER_PREFERENCE_LABELS[key].blurb}</Text>
              </View>
              <Switch
                value={userPreferences[key]}
                onValueChange={(value) => setUserPreference(key, value)}
                trackColor={{ true: THEME.emerald, false: THEME.border }}
              />
            </View>
          ))}
        </Card>
        {demoMode ? (
          <Card className="mt-4" title="Demo mode" subtitle="Switch role without Supabase">
            <RoleToggle current={profile.role} onChange={setDemoRole} />
          </Card>
        ) : (
          <Card className="mt-4" title="Account">
            <Pressable onPress={() => void signOut()} className="mt-2 rounded-xl border border-border bg-card px-4 py-3">
              <Text className="text-center font-bold text-slate">Sign out</Text>
            </Pressable>
          </Card>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <InstallAppBanner />
      <Card className="mt-4" title="Admin panel" subtitle={`Signed in as ${profile.name}`}>
        <Text className="mt-2 text-sm text-muted">
          Kitchen admin tools mirror the softball app&apos;s league admin pattern — global data, seeds, and toggles.
        </Text>
        {!demoMode ? (
          <Pressable onPress={() => void signOut()} className="mt-3 self-start rounded-full border border-border px-4 py-2">
            <Text className="text-xs font-bold text-muted">Sign out</Text>
          </Pressable>
        ) : null}
        {authError ? <Text className="mt-2 text-sm text-danger">{authError}</Text> : null}
      </Card>

      {demoMode || isDemoMode() ? (
        <Card className="mt-4" title="Demo role switch" subtitle="Preview admin vs member UI">
          <RoleToggle current={profile.role} onChange={setDemoRole} />
        </Card>
      ) : null}

      {recipes.length > 0 ? (
        <Card className="mt-4">
          <UsdaNutritionPanel recipes={recipes} onSave={updateRecipe} />
        </Card>
      ) : null}

      <Card className="mt-4" title="Seed test pantry" subtitle="Reset demo inventory">
        <Pressable onPress={seedPantry} className="mt-2 rounded-xl border border-border bg-card px-4 py-3">
          <Text className="text-center font-bold text-slate">Load sample pantry items</Text>
        </Pressable>
      </Card>

      <Card className="mt-4" title="Kitchen preferences">
        {(Object.keys(USER_PREFERENCE_LABELS) as (keyof typeof USER_PREFERENCE_LABELS)[]).map((key) => (
          <View key={key} className="mb-3 flex-row items-center justify-between gap-3 border-b border-border pb-3">
            <View className="flex-1">
              <Text className="font-semibold text-ink">{USER_PREFERENCE_LABELS[key].title}</Text>
              <Text className="text-xs text-muted">{USER_PREFERENCE_LABELS[key].blurb}</Text>
            </View>
            <Switch
              value={userPreferences[key]}
              onValueChange={(value) => setUserPreference(key, value)}
              trackColor={{ true: THEME.emerald, false: THEME.border }}
            />
          </View>
        ))}
      </Card>

      <Card className="mt-4" title="Feature toggles">
        {(Object.keys(FEATURE_FLAG_LABELS) as FeatureFlagKey[]).map((key) => (
          <View key={key} className="mb-3 flex-row items-center justify-between gap-3 border-b border-border pb-3">
            <View className="flex-1">
              <Text className="font-semibold text-ink">{FEATURE_FLAG_LABELS[key].title}</Text>
              <Text className="text-xs text-muted">{FEATURE_FLAG_LABELS[key].blurb}</Text>
            </View>
            <Switch
              value={featureFlags[key]}
              onValueChange={(value) => setFeatureFlag(key, value)}
              trackColor={{ true: THEME.emerald, false: THEME.border }}
            />
          </View>
        ))}
      </Card>

      <Card
        className="mt-4"
        title="Platform analytics"
        subtitle={demoMode ? 'Basic counts (demo)' : 'Aggregate totals only — no per-user data'}
      >
        <Text className="mt-2 text-sm text-muted">Users: {analytics.userCount} ({analytics.adminCount} admin)</Text>
        <Text className="text-sm text-muted">Pantry items (all users): {analytics.pantryItems}</Text>
        <Text className="text-sm text-muted">Recipes (all rows): {analytics.recipes}</Text>
        <Text className="text-sm text-muted">Open grocery lines (all users): {analytics.groceryOpen}</Text>
        <Text className="text-sm text-muted">Last active: {new Date(analytics.lastActiveAt).toLocaleString()}</Text>
      </Card>
    </ScrollView>
  );
}

function AuthPanel({
  authError,
  onSignIn,
  onSignUp,
  onMagicLink,
}: {
  authError: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, name: string) => Promise<void>;
  onMagicLink: (email: string) => Promise<void>;
  }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setStatus(success);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4" title="Sign in" subtitle={APP_BRAND.copy.authCardSubtitle}>
      <BrandLogo variant="auth" />
      <Text className="mt-2 text-sm text-muted">{APP_BRAND.copy.authCardBlurb}</Text>
      <View className="mt-4 flex-row gap-2">
        {(['sign-in', 'sign-up'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setMode(tab)}
            className={`flex-1 rounded-xl px-3 py-2 ${mode === tab ? 'bg-emerald' : 'border border-border bg-card'}`}
          >
            <Text className={`text-center text-sm font-bold ${mode === tab ? 'text-on-emerald' : 'text-muted'}`}>
              {tab === 'sign-in' ? 'Sign in' : 'Create account'}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === 'sign-up' ? (
        <TextInput
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-ink"
          placeholder="Display name"
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        placeholder="Email"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        placeholder={mode === 'sign-up' ? 'Password (min 6 chars)' : 'Password'}
      />
      <Pressable
        disabled={busy || !email.trim()}
        onPress={() =>
          void run(
            () =>
              mode === 'sign-in'
                ? onSignIn(email.trim(), password)
                : onSignUp(email.trim(), password, name.trim()),
            mode === 'sign-in' ? 'Signed in.' : 'Check your email if confirmation is required.',
          )
        }
        className={`mt-4 rounded-xl px-4 py-3 ${busy ? 'opacity-60 bg-emerald' : 'bg-emerald'}`}
      >
        <Text className="text-center font-bold text-on-emerald">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>
      </Pressable>
      <Pressable
        disabled={busy || !email.trim()}
        onPress={() => void run(() => onMagicLink(email.trim()), 'Magic link sent — check your email.')}
        className="mt-3 rounded-xl border border-border bg-card px-4 py-3"
      >
        <Text className="text-center font-bold text-slate">Email magic link</Text>
      </Pressable>
      {authError ? <Text className="mt-3 text-sm text-danger">{authError}</Text> : null}
      {status ? <Text className="mt-2 text-sm text-emerald-dark">{status}</Text> : null}
    </Card>
  );
}

function RoleToggle({ current, onChange }: { current: UserRole; onChange: (role: UserRole) => void }) {
  return (
    <View className="mt-3 flex-row gap-2">
      {(['admin', 'member'] as UserRole[]).map((role) => (
        <Pressable
          key={role}
          onPress={() => onChange(role)}
          className={`flex-1 rounded-xl px-3 py-3 ${current === role ? 'bg-emerald' : 'border border-border bg-card'}`}
        >
          <Text className={`text-center text-sm font-bold ${current === role ? 'text-on-emerald' : 'text-muted'}`}>
            {ROLE_LABELS[role]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
