import { Linking, Pressable, Text, View } from 'react-native';
import { SMART_SHOP_COPY } from '../../config/smartShop';
import { StoreCommunityDealsSection } from './StoreCommunityDealsSection';
import { StoreDeliveryButtons } from './StoreDeliveryButtons';
import { StoreWeeklyAdButton } from './StoreWeeklyAdButton';
import type { DealsSearchResult, StoreLocation } from '../../lib/deals';
import type { CommunityStoreDeal } from '../../lib/communityDeals/types';
import {
  bestDealAcrossStores,
  bestDealPerStoreForItem,
  bestRealDealAcrossStores,
  bestRealDealPerStoreForItem,
  dealsSummaryLabel,
  dealsSummarySubtext,
  estimateSmartShopSavings,
  formatMoney,
  formatStoreTotal,
  isEstimatePricingMode,
  pricingBadgeForStore,
  storeHasPricedTotal,
} from '../../lib/smartShop/aggregateDeals';
import { resultHasRealStorePricing } from '../../lib/smartShop/realPricing';
import type { GroceryListItem } from '../../types/mealprep';
import { formatReportedLight } from '../../lib/communityDeals/client';

type Props = {
  dealsResult: DealsSearchResult;
  items: GroceryListItem[];
  activeStores: StoreLocation[];
  nearbyStores: StoreLocation[];
  storeHasCommunityDeals: (store: StoreLocation) => boolean;
  communityDeals: CommunityStoreDeal[];
  loadingCommunityDeals: boolean;
  communityTableMissing: boolean;
  communityMigrationHint?: string;
  onRefreshCommunityDeals: () => void;
  onOpenDirections: (store: StoreLocation) => void;
  cheapestStoreId: string | null;
  onAddPrice: (store: StoreLocation, itemName?: string) => void;
};

export function SmartShopComparisonResults({
  dealsResult,
  items,
  activeStores,
  nearbyStores,
  storeHasCommunityDeals,
  communityDeals,
  loadingCommunityDeals,
  communityTableMissing,
  communityMigrationHint,
  onRefreshCommunityDeals,
  onOpenDirections,
  cheapestStoreId,
  onAddPrice,
}: Props) {
  const hasRealPricing = resultHasRealStorePricing(dealsResult);
  const isEstimate = isEstimatePricingMode(dealsResult);
  const showRankedSummary = isEstimate || hasRealPricing;
  const savingsEstimate = estimateSmartShopSavings(dealsResult, items.length);
  const summarySubtext = dealsSummarySubtext(dealsResult);
  const suggestionHasTotal =
    showRankedSummary &&
    dealsResult.suggestion.estimatedTotal > 0 &&
    (isEstimate || hasRealPricing);
  const showBestValueLabel =
    showRankedSummary &&
    dealsResult.suggestion.label.length > 0 &&
    !dealsResult.suggestion.label.startsWith('No stores');

  return (
    <View className="mt-4">
      {!hasRealPricing && !isEstimate ? (
        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-sm text-ink">{SMART_SHOP_COPY.noRealPriceComparison}</Text>
          {dealsResult.pricingNote ? (
            <Text className="mt-2 text-xs text-muted">{dealsResult.pricingNote}</Text>
          ) : null}
        </View>
      ) : (
        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted">{dealsSummaryLabel(dealsResult)}</Text>
          {summarySubtext ? <Text className="mt-1 text-xs text-muted">{summarySubtext}</Text> : null}
          {savingsEstimate ? (
            <View className="mt-3 rounded-xl bg-emerald-light px-3 py-2">
              <Text className="text-sm font-bold text-emerald-dark">
                Save up to {formatMoney(savingsEstimate.savingsAmount)} vs highest store
                {savingsEstimate.isDemoPricing ? ' (demo)' : ''}
              </Text>
              <Text className="mt-1 text-xs text-emerald-dark">
                Priced {savingsEstimate.pricedItemCount} of {savingsEstimate.listItemCount} list items
              </Text>
            </View>
          ) : null}
          {showBestValueLabel ? (
            <Text className="mt-2 text-lg font-bold text-ink">{dealsResult.suggestion.label}</Text>
          ) : null}
          {suggestionHasTotal ? (
            <Text className="mt-1 text-2xl font-bold text-emerald-dark">
              {formatStoreTotal(dealsResult.suggestion.estimatedTotal, isEstimate)}
            </Text>
          ) : null}
          {dealsResult.suggestion.note && !isEstimate ? (
            <Text className="mt-2 text-sm text-muted">{dealsResult.suggestion.note}</Text>
          ) : null}
        </View>
      )}

      <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">By store</Text>
      {dealsResult.storeTotals.map((total) => {
        const store = activeStores.find((s) => s.id === total.storeId) ?? nearbyStores.find((s) => s.id === total.storeId);
        if (!store) return null;
        const priced = storeHasPricedTotal(total, dealsResult);
        const isCheapest = cheapestStoreId === total.storeId && priced;
        const onSale = dealsResult.deals.filter(
          (d) => d.storeId === store.id && d.promoLabel && (isEstimate || d.priceSource !== 'sample'),
        );
        return (
          <View
            key={total.storeId}
            className={`mb-3 rounded-xl border px-4 py-3 ${isCheapest ? 'border-emerald bg-emerald-light/50' : 'border-border bg-card'}`}
          >
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-bold text-ink">{store.chain || store.name}</Text>
                  {isCheapest ? (
                    <Text className="rounded-md bg-emerald px-2 py-0.5 text-xs font-bold text-on-emerald">Cheapest</Text>
                  ) : null}
                </View>
                <Text className="text-xs text-muted">
                  {pricingBadgeForStore(store, {
                    hasCommunityDeals: storeHasCommunityDeals(store),
                    resultMode: dealsResult.mode,
                    storeTotal: total,
                    result: dealsResult,
                  })}
                </Text>
                {priced ? (
                  <Text className="mt-1 text-xs text-muted">
                    {total.itemCount}/{items.length} items priced
                    {total.promoCount ? ` · ${total.promoCount} on sale` : ''}
                    {total.missingCount ? ` · ${total.missingCount} not found` : ''}
                  </Text>
                ) : null}
              </View>
              {priced ? (
                <Text className="text-lg font-bold text-emerald-dark">
                  {formatStoreTotal(total.subtotal, isEstimate)}
                </Text>
              ) : null}
            </View>
            {onSale.length > 0 ? (
              <View className="mt-2 border-t border-border pt-2">
                {onSale.slice(0, 4).map((d) => (
                  <Text key={`${d.groceryItemId}-${d.promoLabel}`} className="text-xs text-danger">
                    {items.find((i) => i.id === d.groceryItemId)?.name}: {d.promoLabel} · {formatMoney(d.lineTotal)}
                  </Text>
                ))}
              </View>
            ) : null}
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Pressable onPress={() => onAddPrice(store)} className="self-start">
                <Text className="text-xs font-bold text-emerald-dark">{SMART_SHOP_COPY.addPriceButton}</Text>
              </Pressable>
              <Pressable onPress={() => onOpenDirections(store)} className="self-start">
                <Text className="text-xs font-semibold text-emerald-dark">Directions</Text>
              </Pressable>
              <StoreWeeklyAdButton store={store} />
            </View>
            <View className="mt-2">
              <StoreDeliveryButtons store={store} />
            </View>
            <StoreCommunityDealsSection
              store={store}
              deals={communityDeals}
              loading={loadingCommunityDeals}
              tableMissing={communityTableMissing}
              migrationHint={communityMigrationHint}
              onRefresh={onRefreshCommunityDeals}
            />
          </View>
        );
      })}

      {(hasRealPricing || isEstimate) && items.length > 0 ? (
        <>
          <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Best price per item</Text>
          {items.map((item) => {
            const best = isEstimate
              ? bestDealAcrossStores(dealsResult.deals, item.id)
              : bestRealDealAcrossStores(dealsResult.deals, item.id);
            return (
              <View key={item.id} className="mb-3 rounded-2xl border border-border bg-card p-4">
                <Text className="font-bold text-ink">{item.name}</Text>
                <Text className="text-sm text-muted">
                  Need {item.quantity} {item.unit}
                </Text>
                {best ? (
                  <View className="mt-2">
                    <Text className="text-base font-bold text-emerald-dark">
                      {formatMoney(best.lineTotal)} at {activeStores.find((s) => s.id === best.storeId)?.chain ?? 'store'}
                    </Text>
                    {best.promoLabel ? <Text className="text-xs text-danger">{best.promoLabel}</Text> : null}
                    {best.communityReportedAt ? (
                      <Text className="mt-0.5 text-xs text-muted">{formatReportedLight(best.communityReportedAt)}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text className="mt-2 text-sm text-muted">
                    No verified price yet — check the weekly ad or add one under Deals for a store.
                  </Text>
                )}
                {hasRealPricing || isEstimate ? (
                  <View className="mt-3 border-t border-border pt-2">
                    {activeStores.map((store) => {
                      const deal = isEstimate
                        ? bestDealPerStoreForItem(dealsResult.deals, item.id, store.id)
                        : bestRealDealPerStoreForItem(dealsResult.deals, item.id, store.id);
                      return (
                        <View key={store.id} className="mb-1 flex-row justify-between">
                          <Text className="text-xs text-muted">{store.chain}</Text>
                          <Text className="text-xs font-semibold text-ink">
                            {deal ? formatMoney(deal.lineTotal) : '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                <View className="mt-2 flex-row flex-wrap gap-3">
                  {activeStores.map((store) => (
                    <Pressable key={`add-${store.id}-${item.id}`} onPress={() => onAddPrice(store, item.name)}>
                      <Text className="text-xs font-bold text-emerald-dark">
                        {SMART_SHOP_COPY.addPriceButton} · {store.chain}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {best?.productUrl ? (
                  <Pressable onPress={() => void Linking.openURL(best.productUrl!)} className="mt-2">
                    <Text className="text-xs font-semibold text-emerald-dark">View at store</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

export function resolveCheapestStoreId(result: DealsSearchResult): string | null {
  const priced = result.storeTotals.filter((t) => storeHasPricedTotal(t, result));
  if (priced.length === 0) return null;
  let best = priced[0];
  for (const row of priced) {
    if (row.subtotal < best.subtotal) best = row;
  }
  return best.storeId;
}
