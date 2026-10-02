import { View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AccountOverlays } from './account/AccountOverlays';
import { HandsOnTutorial } from './onboarding/HandsOnTutorial';
import { TutorialContinuePill } from './onboarding/TutorialContinuePill';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { UndoToast } from './UndoToast';

/** Global overlays: onboarding, undo toasts. */
export function AppOverlays() {
  const { undoToast, dismissUndoToast, onboarding, openAuthSheet, isGuest } = useApp();

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-50">
      <AccountOverlays />
      <WelcomeScreen
        visible={onboarding.showWelcome}
        onGetStarted={() => {
          onboarding.dismissWelcomeForSignUp();
          openAuthSheet();
        }}
        onLookAround={onboarding.dismissWelcomeForBrowse}
      />
      <HandsOnTutorial
        visible={onboarding.showTutorialModal}
        progress={onboarding.tutorialProgress}
        recapVisible={onboarding.tutorialRecapVisible}
        guestMode={isGuest}
        onBeginTask={onboarding.beginTutorialTask}
        onSkipStep={onboarding.skipTutorialStep}
        onSkipTutorial={onboarding.skipTour}
        onFinish={onboarding.finishTutorial}
      />
      <TutorialContinuePill visible={onboarding.showTutorialPill} onPress={onboarding.returnToTutorial} />
      {undoToast ? (
        <UndoToast
          message={undoToast.message}
          onUndo={undoToast.onUndo}
          onDismiss={dismissUndoToast}
          actionLabel={undoToast.actionLabel}
          onAction={undoToast.onAction}
        />
      ) : null}
    </View>
  );
}
