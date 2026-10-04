import { View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AccountOverlays } from './account/AccountOverlays';
import { UndoToast } from './UndoToast';

/** Global overlays: undo toasts. Mount only after hydration (see RootOverlays). */
export function AppOverlays() {
  const { undoToast, dismissUndoToast } = useApp();

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-50">
      <AccountOverlays />
      {undoToast ? (
        <UndoToast
          message={undoToast.message}
          onUndo={undoToast.onUndo}
          onDismiss={dismissUndoToast}
          actionLabel={undoToast.actionLabel}
          onAction={undoToast.onAction}
          showUndo={undoToast.showUndo}
        />
      ) : null}
    </View>
  );
}
