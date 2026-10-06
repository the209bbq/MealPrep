import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { HOME_HUB_COPY, type HomeHubSection } from '../../config/homeHub';
import { SAVED_RECIPES_COPY } from '../../config/savedRecipes';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { MealWeekCalendarCard } from '../mealCalendar/MealWeekCalendarCard';
import { CookConfirmBanner } from './CookConfirmBanner';
import { RecipesUnifiedFeedCard } from '../recipes/RecipesUnifiedFeedCard';
import { useApp } from '../../context/AppContext';
import { useHomeHubSheet } from '../../context/HomeHubSheetContext';

function HubSegment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-1 items-center rounded-xl px-2 py-2.5 ${active ? 'bg-primary' : 'bg-paper'}`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <Text className={`text-sm font-bold ${active ? 'text-on-primary' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

export function HomeHubSheet({
  rows,
  guestHint,
  onOpenRow,
}: {
  rows: RecipesTabRow[];
  guestHint?: boolean;
  onOpenRow: (row: RecipesTabRow) => void;
}) {
  const insets = useSafeAreaInsets();
  const { visible, section, closeHub, setSection } = useHomeHubSheet();
  const {
    cookConfirmPrompt,
    confirmCookConfirmPrompt,
    declineCookConfirmPrompt,
    dismissCookConfirmPrompt,
    cookConfirmBusy,
  } = useApp();

  const setHubSection = (next: HomeHubSection) => setSection(next);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={closeHub}>
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center border-b border-border bg-card px-3 py-2">
          <Pressable
            onPress={closeHub}
            accessibilityLabel="Close"
            className="p-2"
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
          >
            <Ionicons name="close" size={22} color={THEME.ink} />
          </Pressable>
          <Text className="flex-1 text-center text-sm font-semibold text-ink">
            {section === 'myRecipes' ? SAVED_RECIPES_COPY.myRecipesTitle : HOME_HUB_COPY.segmentWeekPlan}
          </Text>
          <View className="w-10" />
        </View>

        <View className="flex-row gap-2 border-b border-border bg-card px-3 py-2">
          <HubSegment
            label={HOME_HUB_COPY.segmentMyRecipes}
            active={section === 'myRecipes'}
            onPress={() => setHubSection('myRecipes')}
          />
          <HubSegment
            label={HOME_HUB_COPY.segmentWeekPlan}
            active={section === 'weekPlan'}
            onPress={() => setHubSection('weekPlan')}
          />
        </View>

        {section === 'myRecipes' ? (
          <>
            {guestHint ? (
              <Text className="px-4 py-2 text-xs text-muted">{SAVED_RECIPES_COPY.guestHint}</Text>
            ) : null}
            <ScrollView className="flex-1 px-4 pb-8 pt-2" keyboardShouldPersistTaps="handled">
              {rows.length === 0 ? (
                <Text className="mt-4 text-sm text-muted">{SAVED_RECIPES_COPY.empty}</Text>
              ) : (
                rows.map((row) => (
                  <RecipesUnifiedFeedCard
                    key={row.kind === 'kitchen' ? row.recipe.id : `api-${row.recipe.id}`}
                    row={row}
                    onOpen={() => {
                      closeHub();
                      onOpenRow(row);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </>
        ) : (
          <ScrollView className="flex-1 px-4 pb-8" contentContainerStyle={{ paddingBottom: 24 }}>
            {cookConfirmPrompt ? (
              <CookConfirmBanner
                title={cookConfirmPrompt.title}
                busy={cookConfirmBusy}
                onYes={() => void confirmCookConfirmPrompt()}
                onNotThisTime={declineCookConfirmPrompt}
                onDismiss={dismissCookConfirmPrompt}
              />
            ) : null}
            <MealWeekCalendarCard />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
