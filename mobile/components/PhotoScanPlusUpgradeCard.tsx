import { Pressable, Text, View } from 'react-native';
import { photoScanPlanBlockedMessage } from '../lib/plans/photoScanPlanBlockedMessage';
import { shouldShowUpgradeOffer } from '../lib/platform/shouldShowUpgradeOffer';
import { canBuyPlusHere } from './billing/PlusUpgradeOptions';
import { PlusUpgradeSheet } from './billing/PlusUpgradeSheet';

type Props = {
  onDismiss: () => void;
};

/**
 * Shown when a free account reaches a photo-scan feature. Where Plus can be bought (the web
 * app) this is the full Plus screen; elsewhere it is a short note with nothing to buy.
 */
export function PhotoScanPlusUpgradeCard({ onDismiss }: Props) {
  if (!shouldShowUpgradeOffer()) return null;

  if (canBuyPlusHere()) {
    return <PlusUpgradeSheet visible onClose={onDismiss} />;
  }

  const copy = photoScanPlanBlockedMessage();
  return (
    <View className="mb-2 rounded-[18px] border border-border bg-card px-4 py-4">
      <Text className="text-sm font-bold text-ink">{copy.title}</Text>
      <Text className="mt-1 text-sm leading-5 text-muted">{copy.message}</Text>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        className="mt-3 min-h-[44px] items-center justify-center rounded-full border border-border bg-paper px-4 py-3"
      >
        <Text className="text-sm font-semibold text-muted">Got it</Text>
      </Pressable>
    </View>
  );
}
