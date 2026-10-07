import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useApp } from '../context/AppContext';
import { useUndoToastHost } from '../context/UndoToastHostContext';
import { UndoToast } from './UndoToast';

function UndoToastFromContext() {
  const { undoToast, dismissUndoToast } = useApp();
  if (!undoToast) return null;
  return (
    <UndoToast
      message={undoToast.message}
      onUndo={undoToast.onUndo}
      onDismiss={dismissUndoToast}
      actionLabel={undoToast.actionLabel}
      onAction={undoToast.onAction}
      showUndo={undoToast.showUndo}
    />
  );
}

/** Root host: web portal to document.body; native when no modal sheet is showing the toast. */
export function UndoToastAppHost() {
  const { undoToast } = useApp();
  const { modalHostCount } = useUndoToastHost();
  if (!undoToast) return null;
  if (Platform.OS !== 'web' && modalHostCount > 0) return null;
  return <UndoToastFromContext />;
}

/** Inside RecipeDetailSheet / HomeHubSheet modals (native only). */
export function UndoToastModalHost() {
  const { registerModalHost } = useUndoToastHost();
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    return registerModalHost();
  }, [registerModalHost]);

  if (Platform.OS === 'web') return null;
  return <UndoToastFromContext />;
}
