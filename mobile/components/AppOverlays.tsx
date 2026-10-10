import { View } from 'react-native';
import { AccountOverlays } from './account/AccountOverlays';
import { CheckoutReturnHandler } from './billing/CheckoutReturnHandler';
import { ForkinatorOverlay } from './forkinator/ForkinatorOverlay';
import { MealMadeReviewOverlay } from './MealMadeReviewOverlay';
import { UndoToastAppHost } from './UndoToastHosts';

/**
 * Sheets and dialogs open at z-index 9999 on the web. Forky is pinned in the top bar, so he sits
 * under them: an open sheet covers him instead of him covering the sheet's top-left corner.
 */
const FORKY_LAYER_Z_INDEX = 9000;

/** Global overlays: undo toasts. Mount only after hydration (see RootOverlays). */
export function AppOverlays() {
  return (
    <>
      <View pointerEvents="box-none" className="absolute inset-0" style={{ zIndex: FORKY_LAYER_Z_INDEX }}>
        <ForkinatorOverlay />
      </View>
      <View pointerEvents="box-none" className="absolute inset-0 z-[100000]">
        <CheckoutReturnHandler />
        <AccountOverlays />
        <UndoToastAppHost />
        <MealMadeReviewOverlay />
      </View>
    </>
  );
}
