import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { MaintenanceScreen } from '../../components/MaintenanceScreen';
import { TABS } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';

export default function TabsLayout() {
  const { maintenanceActive } = useApp();

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
          tabBarActiveTintColor: '#047857',
          tabBarInactiveTintColor: '#64748B',
          tabBarStyle: {
            backgroundColor: '#FFFcf7',
            borderTopColor: '#E7E0D6',
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
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={(focused ? tab.iconActive : tab.icon) as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </View>
  );
}
