import type { ComponentProps } from 'react';
import { Ionicons } from '../../lib/icons/Ionicons';
import { Tabs, type Href } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { OfflineNotice } from '../../components/OfflineNotice';
import { HydrationSafeIonicon } from '../../components/HydrationSafeIonicon';
import { MaintenanceScreen } from '../../components/MaintenanceScreen';
import { TABS, THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import { HomeHubSheetProvider } from '../../context/HomeHubSheetContext';
import { useHydrated } from '../../hooks/useHydrated';
import { useScanActivity } from '../../hooks/useScanActivity';
import { pantryTabBadge } from '../../lib/pantry/scanActivity';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { maintenanceActive, isAdmin } = useApp();
  const hydrated = useHydrated();
  // Pantry photo scans run in the background; the badge says one is running or a list is waiting.
  const pantryBadge = pantryTabBadge(useScanActivity());

  if (hydrated && maintenanceActive) {
    return (
      <HomeHubSheetProvider>
        <View className="mx-auto min-h-full w-full max-w-lg flex-1 bg-paper">
          <AppHeader />
          <OfflineNotice />
          <MaintenanceScreen />
        </View>
      </HomeHubSheetProvider>
    );
  }

  return (
    <HomeHubSheetProvider>
      <View className="mx-auto min-h-full w-full max-w-lg flex-1 bg-paper">
        <AppHeader />
        <OfflineNotice />
        <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: THEME.primary,
          // Approved design (D-2): 68px white bar, green pill behind the current tab's icon.
          tabBarInactiveTintColor: THEME.muted,
          tabBarStyle: {
            backgroundColor: THEME.card,
            borderTopColor: THEME.border,
            height: 68,
            paddingBottom: 8,
            paddingTop: 7,
          },
          tabBarIconStyle: { width: 56, height: 30 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name === 'index' ? 'index' : tab.name}
            options={{
              title: tab.title,
              href: (tab.adminOnly && !isAdmin ? null : tab.href) as Href | null,
              tabBarBadge: tab.name === 'pantry' ? pantryBadge : undefined,
              tabBarBadgeStyle: { backgroundColor: THEME.tomato, color: THEME.card, fontWeight: '700' },
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    width: 56,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: focused ? THEME.primaryLight : 'transparent',
                  }}
                >
                  <HydrationSafeIonicon
                    name={(focused ? tab.iconActive : tab.icon) as IoniconName}
                    size={22}
                    color={color}
                  />
                </View>
              ),
            }}
          />
        ))}
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
        <Tabs.Screen name="recipes" options={{ href: null, title: 'Recipes' }} />
      </Tabs>
      </View>
    </HomeHubSheetProvider>
  );
}
