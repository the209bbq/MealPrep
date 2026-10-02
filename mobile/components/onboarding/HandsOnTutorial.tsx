import { Ionicons } from '../../lib/icons/Ionicons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HANDS_ON_TUTORIAL_STEP_COUNT, ONBOARDING_COPY } from '../../config/onboarding';
import { THEME } from '../../config/appConfig';
import type { HandsOnTutorialProgress } from '../../lib/onboarding/tutorialProgress';
import { HANDS_ON_TUTORIAL_STEP_ORDER, isTutorialRecapScreen } from '../../lib/onboarding/tutorialProgress';
import type { TutorialTaskLaunch } from '../../hooks/useOnboarding';

type HandsOnTutorialProps = {
  visible: boolean;
  progress: HandsOnTutorialProgress;
  recapVisible: boolean;
  onBeginTask: (launch: TutorialTaskLaunch) => void;
  onSkipStep: () => void;
  onSkipTutorial: () => void;
  onFinish: () => void;
};

export function HandsOnTutorial({
  visible,
  progress,
  recapVisible,
  onBeginTask,
  onSkipStep,
  onSkipTutorial,
  onFinish,
}: HandsOnTutorialProps) {
  const insets = useSafeAreaInsets();
  const { tutorial } = ONBOARDING_COPY;

  const stepIndex = Math.min(progress.activeIndex, HANDS_ON_TUTORIAL_STEP_COUNT - 1);
  const stepCopy = tutorial.steps[stepIndex];
  const showRecap = recapVisible || isTutorialRecapScreen(progress);

  function handlePrimary() {
    if (showRecap) {
      onFinish();
      return;
    }
    if (!stepCopy) return;
    onBeginTask({
      kind: 'route',
      href: stepCopy.primaryHref,
      pantryAction: stepCopy.primaryPantryAction,
    });
  }

  function handleSecondary() {
    if (!stepCopy?.secondaryCta) return;
    onBeginTask({ kind: 'pantry', action: 'manual' });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onSkipTutorial}>
      <View className="flex-1 justify-end bg-black/50" style={{ paddingBottom: insets.bottom }}>
        <View className="rounded-t-3xl border border-border bg-card px-5 pb-6 pt-5">
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted">
              {showRecap
                ? 'Done'
                : tutorial.progressLabel(stepIndex + 1, HANDS_ON_TUTORIAL_STEP_COUNT)}
            </Text>
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={onSkipStep}
                accessibilityRole="button"
                hitSlop={8}
                className="min-h-[44px] items-center justify-center rounded-xl px-3"
              >
                <Text className="text-sm font-bold text-primary">{tutorial.skipStep}</Text>
              </Pressable>
              <Pressable
                onPress={onSkipTutorial}
                accessibilityRole="button"
                hitSlop={8}
                className="min-h-[44px] items-center justify-center rounded-xl px-3"
              >
                <Text className="text-sm font-bold text-muted">{tutorial.skipTutorial}</Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-4 flex-row flex-wrap gap-2">
            {HANDS_ON_TUTORIAL_STEP_ORDER.map((id, index) => {
              const status = progress.steps[id];
              const done = status === 'done' || status === 'skipped';
              const current = !showRecap && index === stepIndex;
              return (
                <View
                  key={id}
                  className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${
                    current ? 'bg-primary-light' : 'bg-paper'
                  }`}
                >
                  {done ? (
                    <Ionicons name="checkmark-circle" size={16} color={THEME.primary} />
                  ) : (
                    <View className="h-2 w-2 rounded-full bg-border" />
                  )}
                  <Text className={`text-xs font-semibold ${current ? 'text-primary' : 'text-muted'}`}>
                    {index + 1}
                  </Text>
                </View>
              );
            })}
          </View>

          {showRecap ? (
            <>
              <View className="items-center">
                <View className="rounded-full bg-primary-light p-4">
                  <Ionicons name="checkmark-circle" size={36} color={THEME.primary} />
                </View>
                <Text className="mt-4 text-center text-xl font-bold text-ink">{tutorial.recap.title}</Text>
                <Text className="mt-2 text-center text-sm leading-6 text-muted">{tutorial.recap.body}</Text>
              </View>
              <Pressable
                onPress={handlePrimary}
                className="mt-6 min-h-[52px] items-center justify-center rounded-2xl bg-primary px-4 py-4"
              >
                <Text className="text-lg font-bold text-on-primary">{tutorial.recap.cta}</Text>
              </Pressable>
            </>
          ) : stepCopy ? (
            <>
              <View className="flex-row items-start gap-3">
                <View className="rounded-2xl bg-primary-light p-3">
                  <Ionicons name={stepCopy.icon} size={28} color={THEME.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-ink">{stepCopy.title}</Text>
                  <Text className="mt-2 text-sm leading-6 text-muted">{stepCopy.body}</Text>
                </View>
              </View>
              <Pressable
                onPress={handlePrimary}
                className="mt-6 min-h-[52px] items-center justify-center rounded-2xl bg-primary px-4 py-4"
              >
                <Text className="text-lg font-bold text-on-primary">{stepCopy.primaryCta}</Text>
              </Pressable>
              {stepCopy.secondaryCta ? (
                <Pressable
                  onPress={handleSecondary}
                  className="mt-3 min-h-[48px] items-center justify-center rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <Text className="text-base font-bold text-ink">{stepCopy.secondaryCta}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
