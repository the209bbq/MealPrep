import { View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AccountOverlays } from './account/AccountOverlays';
import { UndoToastAppHost } from './UndoToastHosts';

/** Global overlays: undo toasts. Mount only after hydration (see RootOverlays). */
export function AppOverlays() {
  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-[100000]">
      <AccountOverlays />
      <UndoToastAppHost />
    </View>
  );
}
