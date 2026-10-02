import { Ionicons } from '../../lib/icons/Ionicons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '../BrandLogo';
import { ONBOARDING_COPY } from '../../config/onboarding';
import { APP_TAGLINE, THEME } from '../../config/appConfig';

type WelcomeScreenProps = {
  visible: boolean;
  onGetStarted: () => void;
  onLookAround: () => void;
};

export function WelcomeScreen({ visible, onGetStarted, onLookAround }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { welcome } = ONBOARDING_COPY;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <ScrollView
        className="flex-1 bg-paper"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <BrandLogo variant="auth" />
        <Text className="mt-4 text-center text-2xl font-bold leading-snug text-ink">{welcome.valueProp}</Text>
        <Text className="mt-2 text-center text-sm text-muted">{APP_TAGLINE}</Text>

        <View className="mt-8 gap-3">
          {welcome.benefits.map((benefit) => (
            <View
              key={benefit.id}
              className="flex-row items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4"
            >
              <View className="rounded-xl bg-primary-light p-2.5">
                <Ionicons name={benefit.icon} size={24} color={THEME.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-ink">{benefit.title}</Text>
                <Text className="mt-1 text-sm leading-5 text-muted">{benefit.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={onGetStarted}
          accessibilityRole="button"
          accessibilityLabel={welcome.primaryCta}
          className="mt-8 min-h-[52px] items-center justify-center rounded-2xl bg-primary px-4 py-4"
        >
          <Text className="text-lg font-bold text-on-primary">{welcome.primaryCta}</Text>
        </Pressable>

        <Pressable
          onPress={onLookAround}
          accessibilityRole="button"
          accessibilityLabel={welcome.secondaryCta}
          className="mt-3 min-h-[48px] items-center justify-center rounded-2xl border border-border bg-card px-4 py-3"
        >
          <Text className="text-base font-bold text-ink">{welcome.secondaryCta}</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}
