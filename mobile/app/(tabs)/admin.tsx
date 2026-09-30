import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { FEATURE_FLAG_LABELS, ROLE_LABELS, THEME, isDemoMode } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import { initials } from '../../lib/initials';
import type { FeatureFlagKey, UserRole } from '../../types/mealprep';

export default function AdminScreen() {
  const {
    profile,
    isAdmin,
    demoMode,
    setDemoRole,
    featureFlags,
    setFeatureFlag,
    seedPantry,
    analytics,
    recipes,
    updateRecipe,
  } = useApp();
  const [editId, setEditId] = useState(recipes[0]?.id ?? '');
  const recipe = recipes.find((r) => r.id === editId) ?? recipes[0];
  const [editName, setEditName] = useState(recipe?.name ?? '');
  const [editDesc, setEditDesc] = useState(recipe?.description ?? '');

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
        {demoMode ? (
          <Card className="mt-4" title="Demo mode" subtitle="Switch role without Supabase">
            <RoleToggle current={profile.role} onChange={setDemoRole} />
          </Card>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card className="mt-4" title="Admin panel" subtitle={`Signed in as ${profile.name}`}>
        <Text className="mt-2 text-sm text-muted">
          Kitchen admin tools mirror the softball app&apos;s league admin pattern — global data, seeds, and toggles.
        </Text>
      </Card>

      {demoMode || isDemoMode() ? (
        <Card className="mt-4" title="Demo role switch" subtitle="Preview admin vs member UI">
          <RoleToggle current={profile.role} onChange={setDemoRole} />
        </Card>
      ) : null}

      <Card className="mt-4" title="Recipe master table" subtitle="Edit global recipes (demo/local)">
        <Text className="mb-2 text-sm text-muted">Select recipe</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {recipes.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                setEditId(r.id);
                setEditName(r.name);
                setEditDesc(r.description);
              }}
              className={`rounded-full px-3 py-1 ${editId === r.id ? 'bg-emerald' : 'bg-paper border border-border'}`}
            >
              <Text className={`text-xs font-semibold ${editId === r.id ? 'text-on-emerald' : 'text-muted'}`}>
                {r.name.split(' ')[0]}
              </Text>
            </Pressable>
          ))}
        </View>
        {featureFlags.recipeMasterEdit && recipe ? (
          <>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              className="mb-2 rounded-xl border border-border bg-card px-3 py-2 text-ink"
              placeholder="Recipe name"
            />
            <TextInput
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              className="mb-3 rounded-xl border border-border bg-card px-3 py-2 text-ink"
              placeholder="Description"
            />
            <Pressable
              onPress={() => updateRecipe({ ...recipe, name: editName, description: editDesc })}
              className="rounded-xl bg-emerald px-4 py-3"
            >
              <Text className="text-center font-bold text-on-emerald">Save master recipe</Text>
            </Pressable>
          </>
        ) : (
          <Text className="text-sm text-muted">Recipe master edit is disabled.</Text>
        )}
      </Card>

      <Card className="mt-4" title="Seed test pantry" subtitle="Reset demo inventory">
        <Pressable onPress={seedPantry} className="mt-2 rounded-xl border border-border bg-card px-4 py-3">
          <Text className="text-center font-bold text-slate">Load sample pantry items</Text>
        </Pressable>
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

      <Card className="mt-4" title="User analytics" subtitle="Basic counts (demo)">
        <Text className="mt-2 text-sm text-muted">Users: {analytics.userCount} ({analytics.adminCount} admin)</Text>
        <Text className="text-sm text-muted">Pantry items: {analytics.pantryItems}</Text>
        <Text className="text-sm text-muted">Recipes: {analytics.recipes}</Text>
        <Text className="text-sm text-muted">Open grocery lines: {analytics.groceryOpen}</Text>
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
