import { ScrollView, Text, View } from 'react-native';
import { GuestSaveNudge } from '../../components/GuestSaveNudge';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { CookConfirmBanner } from '../../components/home/CookConfirmBanner';
import { HomeMyRecipesStrip } from '../../components/home/HomeMyRecipesStrip';
import { MealWeekCalendarCard } from '../../components/mealCalendar/MealWeekCalendarCard';
import { useApp } from '../../context/AppContext';

export default function HomeScreen() {
  const {
    demoMode,
    cookConfirmPrompt,
    confirmCookConfirmPrompt,
    declineCookConfirmPrompt,
    dismissCookConfirmPrompt,
    cookConfirmBusy,
  } = useApp();

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 bg-paper px-4 pb-8" contentContainerStyle={{ paddingBottom: 24 }}>
        <InstallAppBanner />
        <GuestSaveNudge />

        <HomeMyRecipesStrip />

        <MealWeekCalendarCard />

        {cookConfirmPrompt ? (
          <CookConfirmBanner
            title={cookConfirmPrompt.title}
            busy={cookConfirmBusy}
            onYes={() => void confirmCookConfirmPrompt()}
            onNotThisTime={declineCookConfirmPrompt}
            onDismiss={dismissCookConfirmPrompt}
          />
        ) : null}

        {demoMode ? (
          <Text className="mt-3 text-xs text-muted">
            Demo mode — local data only until you sign in with a connected account.
          </Text>
        ) : null}
      </ScrollView>

    </View>
  );
}
