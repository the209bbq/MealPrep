import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { THEME } from '../../config/appConfig';

export default function AdminRoute() {
  const [Screen, setScreen] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;
    void import('../../screens/lazy/AdminScreen').then((module) => {
      if (active) setScreen(() => module.default);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!Screen) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={THEME.primary} />
      </View>
    );
  }

  return <Screen />;
}
