import { View } from 'react-native';
import { useApp } from '../context/AppContext';
import { UndoToast } from './UndoToast';

/** Global undo toasts (grocery auto-add, mark meal made). */
export function AppOverlays() {
  const { undoToast, dismissUndoToast } = useApp();

  if (!undoToast) return null;

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-50">
      <UndoToast message={undoToast.message} onUndo={undoToast.onUndo} onDismiss={dismissUndoToast} />
    </View>
  );
}
