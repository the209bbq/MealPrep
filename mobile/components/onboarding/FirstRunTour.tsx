import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ONBOARDING_COPY } from '../../config/onboarding';
import { THEME } from '../../config/appConfig';

type FirstRunTourProps = {
  visible: boolean;
  onFinish: () => void;
  onSkip: () => void;
};

export function FirstRunTour({ visible, onFinish, onSkip }: FirstRunTourProps) {
  const insets = useSafeAreaInsets();
  const { tour } = ONBOARDING_COPY;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!visible) setStepIndex(0);
  }, [visible]);

  const onFinishStep = stepIndex >= tour.steps.length;
  const step = onFinishStep ? null : tour.steps[stepIndex];

  function handlePrimary() {
    if (onFinishStep) {
      onFinish();
      setStepIndex(0);
      return;
    }
    if (stepIndex < tour.steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    setStepIndex(tour.steps.length);
  }

  function handleSkip() {
    setStepIndex(0);
    onSkip();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleSkip}>
      <View className="flex-1 justify-end bg-black/50" style={{ paddingBottom: insets.bottom }}>
        <View className="rounded-t-3xl border border-border bg-card px-5 pb-6 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted">
              {onFinishStep ? 'Done' : `Step ${stepIndex + 1} of ${tour.steps.length}`}
            </Text>
            <Pressable
              onPress={handleSkip}
              accessibilityRole="button"
              hitSlop={12}
              className="min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-3"
            >
              <Text className="text-sm font-bold text-primary">{tour.skip}</Text>
            </Pressable>
          </View>

          {onFinishStep ? (
            <>
              <View className="items-center">
                <View className="rounded-full bg-primary-light p-4">
                  <Ionicons name="camera-outline" size={36} color={THEME.primary} />
                </View>
                <Text className="mt-4 text-center text-xl font-bold text-ink">{tour.finishTitle}</Text>
                <Text className="mt-2 text-center text-sm leading-6 text-muted">{tour.finishBody}</Text>
              </View>
              <Pressable
                onPress={handlePrimary}
                className="mt-6 min-h-[52px] items-center justify-center rounded-2xl bg-primary px-4 py-4"
              >
                <Text className="text-lg font-bold text-on-primary">{tour.finishCta}</Text>
              </Pressable>
            </>
          ) : step ? (
            <>
              <View className="flex-row items-start gap-3">
                <View className="rounded-2xl bg-primary-light p-3">
                  <Ionicons name={step.icon} size={28} color={THEME.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold uppercase text-primary">{step.tabHint}</Text>
                  <Text className="mt-1 text-xl font-bold text-ink">{step.title}</Text>
                  <Text className="mt-2 text-sm leading-6 text-muted">{step.body}</Text>
                </View>
              </View>
              <Pressable
                onPress={handlePrimary}
                className="mt-6 min-h-[48px] items-center justify-center rounded-2xl bg-primary px-4 py-3"
              >
                <Text className="text-base font-bold text-on-primary">{tour.next}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
