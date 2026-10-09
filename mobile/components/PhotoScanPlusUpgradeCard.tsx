import { Pressable, Text, View } from 'react-native';
import { photoScanPlanBlockedMessage } from '../lib/plans/photoScanPlanBlockedMessage';
import { shouldShowUpgradeOffer } from '../lib/platform/shouldShowUpgradeOffer';
import { canBuyPlusHere, PlusUpgradeOptions } from './billing/PlusUpgradeOptions';

type Props = {
  onDismiss: () => void;
};

/** Shown when a free account reaches a photo-scan feature: what Plus is, and how to get it. */
export function PhotoScanPlusUpgradeCard({ onDismiss }: Props) {
  if (!shouldShowUpgradeOffer()) return null;

  const copy = photoScanPlanBlockedMessage();
  return (
    <View className="mb-2 rounded-2xl border border-primary bg-primary-light px-4 py-4">
      <Text className="text-sm font-bold text-ink">{copy.title}</Text>
      <Text className="mt-1 text-sm leading-5 text-muted">{copy.message}</Text>
      {canBuyPlusHere() ? (
        <PlusUpgradeOptions onNotNow={onDismiss} />
      ) : (
        <Pressable
          onPress={onDismiss}
          className="mt-3 items-center rounded-xl border border-border bg-paper px-4 py-3"
        >
          <Text className="text-sm font-semibold text-muted">Got it</Text>
        </Pressable>
      )}
    </View>
  );
}
