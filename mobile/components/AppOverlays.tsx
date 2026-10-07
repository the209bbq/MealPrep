import { View } from 'react-native';
import { AccountOverlays } from './account/AccountOverlays';
import { ForkinatorOverlay } from './forkinator/ForkinatorOverlay';
import { UndoToastAppHost } from './UndoToastHosts';

/** Global overlays: undo toasts. Mount only after hydration (see RootOverlays). */
export function AppOverlays() {
  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-[100000]">
      <AccountOverlays />
      <UndoToastAppHost />
      <ForkinatorOverlay />
    </View>
  );
}
