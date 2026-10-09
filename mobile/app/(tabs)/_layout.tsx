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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { maintenanceActive, isAdmin } = useApp();
  const hydrated = useHydrated();

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
          tabBarInactiveTintColor: THEME.slateMuted,
          tabBarStyle: {
            backgroundColor: THEME.card,
            borderTopColor: THEME.border,
            height: 60,
            paddingBottom: 6,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name === 'index' ? 'index' : tab.name}
            options={{
              title: tab.title,
              href: (tab.adminOnly && !isAdmin ? null : tab.href) as Href | null,
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    width: 52,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: focused ? THEME.primaryLight : 'transparent',
                  }}
                >
                  <HydrationSafeIonicon
                    name={(focused ? tab.iconActive : tab.icon) as IoniconName}
                    size={20}
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
