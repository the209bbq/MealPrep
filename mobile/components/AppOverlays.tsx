import { View } from 'react-native';
import { useApp } from '../context/AppContext';
import { FirstRunTour } from './onboarding/FirstRunTour';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { UndoToast } from './UndoToast';

/** Global overlays: onboarding, undo toasts. */
export function AppOverlays() {
  const { undoToast, dismissUndoToast, onboarding } = useApp();

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-50">
      <WelcomeScreen
        visible={onboarding.showWelcome}
        onGetStarted={onboarding.dismissWelcomeForSignUp}
        onLookAround={onboarding.dismissWelcomeForBrowse}
      />
      <FirstRunTour
        visible={onboarding.showTour}
        onFinish={onboarding.completeTour}
        onSkip={onboarding.skipTour}
      />
      {undoToast ? (
        <UndoToast message={undoToast.message} onUndo={undoToast.onUndo} onDismiss={dismissUndoToast} />
      ) : null}
    </View>
  );
}
