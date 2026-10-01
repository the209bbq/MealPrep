import { Redirect } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { TourReplayCard } from '../../components/onboarding/TourReplayCard';
import { FEATURE_FLAG_LABELS, ROLE_LABELS, THEME, isDemoMode } from '../../config/appConfig';
import { APP_ROUTES } from '../../config/appRoutes';
import { USER_PREFERENCE_LABELS } from '../../config/userPreferences';
import { useApp } from '../../context/AppContext';
import type { FeatureFlagKey, UserRole } from '../../types/mealprep';

export default function AdminScreen() {
  const {
    profile,
    isAdmin,
    demoMode,
    authReady,
    authError,
    setDemoRole,
    signOut,
    featureFlags,
    setFeatureFlag,
    userPreferences,
    setUserPreference,
    seedPantry,
    analytics,
    onboarding,
    session,
  } = useApp();

  if (!authReady) {
    return (
      <ScrollView className="flex-1 bg-paper px-4 pb-8">
        <Card className="mt-4" title="Admin" subtitle="Loading…">
          <Text className="mt-2 text-sm text-muted">Checking access.</Text>
        </Card>
      </ScrollView>
    );
  }

  if (!demoMode && !session) {
    return <Redirect href={APP_ROUTES.profile} />;
  }

  if (!isAdmin) {
    return <Redirect href={APP_ROUTES.profile} />;
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

      <Card className="mt-4" title="Seed test pantry" subtitle="Reset demo inventory">
        <Pressable onPress={seedPantry} className="mt-2 rounded-xl border border-border bg-card px-4 py-3">
          <Text className="text-center font-bold text-slate">Load sample pantry items</Text>
        </Pressable>
      </Card>

      <TourReplayCard onReplay={onboarding.requestTourReplay} />

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
              trackColor={{ true: THEME.primary, false: THEME.border }}
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
              trackColor={{ true: THEME.primary, false: THEME.border }}
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

function RoleToggle({ current, onChange }: { current: UserRole; onChange: (role: UserRole) => void }) {
  return (
    <View className="mt-3 flex-row gap-2">
      {(['admin', 'member'] as UserRole[]).map((role) => (
        <Pressable
          key={role}
          onPress={() => onChange(role)}
          className={`flex-1 rounded-xl px-3 py-3 ${current === role ? 'bg-primary' : 'border border-border bg-card'}`}
        >
          <Text className={`text-center text-sm font-bold ${current === role ? 'text-on-primary' : 'text-muted'}`}>
            {ROLE_LABELS[role]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
