import { Pressable, Text } from 'react-native';
import {
  resolveWeeklyAdChain,
  weeklyAdButtonLabel,
  type WeeklyAdChainConfig,
} from '../../config/weeklyAds';
import type { StoreLocation } from '../../lib/deals/types';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';

interface StoreWeeklyAdButtonProps {
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>;
  className?: string;
}

export function resolveWeeklyAdForStore(
  store: Pick<StoreLocation, 'name' | 'chain' | 'krogerLocationId' | 'pricingSource'>,
): WeeklyAdChainConfig | null {
  return resolveWeeklyAdChain(store);
}

export function StoreWeeklyAdButton({ store, className }: StoreWeeklyAdButtonProps) {
  const chain = resolveWeeklyAdForStore(store);
  if (!chain) return null;

  const label = weeklyAdButtonLabel(chain);

  return (
    <Pressable
      onPress={() => void openExternalUrl(chain.url).catch(() => undefined)}
      className={`min-h-[40px] flex-row items-center justify-center rounded-xl border border-emerald bg-emerald-light px-3 py-2 ${className ?? ''}`}
    >
      <Text className="text-xs font-bold text-emerald-dark">{label}</Text>
    </Pressable>
  );
}
