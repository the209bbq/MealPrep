import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { SMART_SHOP_COPY } from '../../config/smartShop';
import { copyTextToClipboard } from '../../lib/smartShop/copyToClipboard';
import { openGroceryItems } from '../../lib/smartShop/aggregateDeals';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';
import {
  formatRetailerListClipboard,
  retailerItemSearchLabel,
  retailerItemSearchUrl,
  retailerWholeListLabel,
  retailerWholeListSearchUrl,
  resolveRetailerForStore,
} from '../../lib/smartShop/retailerLinks';
import type { StoreLocation } from '../../lib/deals/types';
import type { GroceryListItem } from '../../types/mealprep';

type Props = {
  store: StoreLocation;
  grocery: GroceryListItem[];
};

function RetailerChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-lg border border-border bg-paper px-2 py-1">
      <Text className="text-xs font-semibold text-primary-dark">{label}</Text>
    </Pressable>
  );
}

export function StoreRetailerButtons({ store, grocery }: Props) {
  const retailer = resolveRetailerForStore(store);
  const items = openGroceryItems(grocery);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);

  if (!retailer || items.length === 0) return null;

  async function openItem(itemName: string) {
    await openExternalUrl(retailerItemSearchUrl(retailer!, itemName));
  }

  async function shopWholeList() {
    const text = formatRetailerListClipboard(items);
    await copyTextToClipboard(text);
    setClipboardToast(SMART_SHOP_COPY.retailerListCopiedToast);
    setTimeout(() => setClipboardToast(null), 3500);
    await openExternalUrl(retailerWholeListSearchUrl(retailer!, items));
  }

  return (
    <View className="mt-2">
      <Text className="text-xs font-bold uppercase tracking-wide text-muted">Store site</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        <RetailerChip label={retailerWholeListLabel(retailer)} onPress={() => void shopWholeList()} />
      </View>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {items.slice(0, 6).map((item) => (
          <RetailerChip
            key={item.id}
            label={retailerItemSearchLabel(retailer, item.name)}
            onPress={() => void openItem(item.name)}
          />
        ))}
      </View>
      {items.length > 6 ? (
        <Text className="mt-1 text-xs text-muted">+{items.length - 6} more items — use Shop whole list</Text>
      ) : null}
      {clipboardToast ? (
        <Text className="mt-2 text-xs font-semibold text-success-dark">{clipboardToast}</Text>
      ) : null}
    </View>
  );
}

export function ItemRetailerSearchButtons({
  store,
  itemName,
}: {
  store: StoreLocation;
  itemName: string;
}) {
  const retailer = resolveRetailerForStore(store);
  if (!retailer) return null;

  return (
    <Pressable onPress={() => void openExternalUrl(retailerItemSearchUrl(retailer, itemName))} className="self-start">
      <Text className="text-xs font-semibold text-primary-dark">
        {retailerItemSearchLabel(retailer, itemName)}
      </Text>
    </Pressable>
  );
}
