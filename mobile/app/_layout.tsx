import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppOverlays } from '../components/AppOverlays';
import { AppProvider } from '../context/AppContext';
import { ScheduleRecipeSheetProvider } from '../context/ScheduleRecipeSheetContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ScheduleRecipeSheetProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="smart-shop" options={{ presentation: 'card' }} />
              <Stack.Screen name="discover-recipes" options={{ presentation: 'card' }} />
              <Stack.Screen name="discover-recipes/[id]" options={{ presentation: 'card' }} />
            </Stack>
            <AppOverlays />
          </ScheduleRecipeSheetProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
