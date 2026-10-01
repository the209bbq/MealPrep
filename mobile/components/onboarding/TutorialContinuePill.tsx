import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COPY } from '../../config/onboarding';

type TutorialContinuePillProps = {
  visible: boolean;
  onPress: () => void;
};

export function TutorialContinuePill({ visible, onPress }: TutorialContinuePillProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-[60] items-center"
      style={{ bottom: insets.bottom + 72 }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={ONBOARDING_COPY.tutorial.continuePill}
        className="min-h-[48px] rounded-full bg-primary px-5 py-3 shadow-lg"
      >
        <Text className="text-base font-bold text-on-primary">{ONBOARDING_COPY.tutorial.continuePill}</Text>
      </Pressable>
    </View>
  );
}
