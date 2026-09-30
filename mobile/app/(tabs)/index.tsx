import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { CookFromPantryCard } from '../../components/RecipePantryMatch';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { APP_NAME, APP_TAGLINE, THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';

const HIGHLIGHTS = [
  { icon: 'camera-outline' as const, title: 'Photo pantry', body: 'Snap shelves and track what you have on hand.' },
  { icon: 'calculator-outline' as const, title: 'Batch prep', body: 'Scale recipes for the week in one pass.' },
  { icon: 'cart-outline' as const, title: 'Smart grocery', body: 'Shop only what recipes still need.' },
];

export default function HomeScreen() {
  const { summary, demoMode, profile, pantryRecipeRecommendations } = useApp();

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8" contentContainerStyle={{ paddingBottom: 24 }}>
      <InstallAppBanner />

      <View className="mt-4 overflow-hidden rounded-3xl bg-slate px-5 py-8">
        <Text className="text-xs font-bold uppercase tracking-widest text-emerald-light">{APP_NAME}</Text>
        <Text className="mt-2 text-3xl font-bold leading-tight text-on-emerald">Your smart kitchen command center</Text>
        <Text className="mt-3 text-base text-emerald-light">{APP_TAGLINE}</Text>
        {demoMode && (
          <Text className="mt-3 text-xs text-sand">Demo mode — Supabase env vars are empty. Data is local mock storage.</Text>
        )}
      </View>

      <View className="mt-4 flex-row gap-3">
        {[
          { label: 'Scan', route: '/pantry' as const, icon: 'camera' as const },
          { label: 'Cook', route: '/recipes' as const, icon: 'flame' as const },
          { label: 'Shop', route: '/grocery' as const, icon: 'cart' as const },
        ].map((action) => (
          <Pressable
            key={action.label}
            onPress={() => router.push(action.route)}
            className="flex-1 items-center rounded-2xl border border-border bg-card py-4"
          >
            <Ionicons name={action.icon} size={24} color={THEME.emerald} />
            <Text className="mt-2 text-sm font-bold text-ink">{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <Card className="mt-4" title="Today's meal prep" subtitle={`${profile.name} · ${summary.date}`}>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[
            { label: 'Meals planned', value: String(summary.mealsPlanned) },
            { label: 'Pantry items', value: String(summary.pantryItems) },
            { label: 'Grocery left', value: String(summary.groceryRemaining) },
            { label: 'Protein (g)', value: String(summary.proteinGrams) },
          ].map((stat) => (
            <View key={stat.label} className="min-w-[45%] flex-1 rounded-xl bg-emerald-light px-3 py-2">
              <Text className="text-xs font-semibold text-emerald-dark">{stat.label}</Text>
              <Text className="text-xl font-bold text-ink">{stat.value}</Text>
            </View>
          ))}
        </View>
      </Card>

      <CookFromPantryCard
        recommendations={pantryRecipeRecommendations}
        onOpenRecipe={(recipeId) => router.push({ pathname: '/recipes', params: { recipeId } })}
      />

      <Text className="mb-2 mt-6 text-lg font-bold text-ink">Why Meal Prep</Text>
      {HIGHLIGHTS.map((item) => (
        <Card key={item.title} className="mb-3">
          <View className="flex-row items-start gap-3">
            <Ionicons name={item.icon} size={22} color={THEME.slate} />
            <View className="flex-1">
              <Text className="font-bold text-ink">{item.title}</Text>
              <Text className="mt-1 text-sm text-muted">{item.body}</Text>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
