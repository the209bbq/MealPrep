import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, type Href } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { HydrationSafeIonicon } from '../../components/HydrationSafeIonicon';
import { MaintenanceScreen } from '../../components/MaintenanceScreen';
import { TABS, THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { maintenanceActive, isAdmin } = useApp();

  if (maintenanceActive) {
    return (
      <View className="mx-auto min-h-full w-full max-w-lg flex-1 bg-paper">
        <AppHeader />
        <MaintenanceScreen />
      </View>
    );
  }

  return (
    <View className="mx-auto min-h-full w-full max-w-lg flex-1 bg-paper">
      <AppHeader />
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
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
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
                <HydrationSafeIonicon
                  name={(focused ? tab.iconActive : tab.icon) as IoniconName}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
        ))}
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
      </Tabs>
    </View>
  );
}
