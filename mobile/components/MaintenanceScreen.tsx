import { Text, View } from 'react-native';
import { APP_NAME, APP_TAGLINE } from '../config/appConfig';

export function MaintenanceScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate px-6">
      <Text className="text-sm font-semibold uppercase tracking-widest text-on-primary-muted">Kitchen pause</Text>
      <Text className="mt-3 text-center text-2xl font-bold text-on-emerald">Down for maintenance</Text>
      <Text className="mt-3 text-center text-base text-on-primary-muted">
        {APP_NAME} is getting a quick refresh. {APP_TAGLINE}
      </Text>
    </View>
  );
}
