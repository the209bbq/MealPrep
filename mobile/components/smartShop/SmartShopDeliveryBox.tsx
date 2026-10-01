import { Text, View } from 'react-native';
import { useState } from 'react';
import { DELIVERY_CLIPBOARD_TOAST } from '../../config/smartShopDelivery';
import { SMART_SHOP_COPY } from '../../config/smartShop';
import type { DeliveryServiceId } from '../../config/smartShopChains';
import { copyTextToClipboard } from '../../lib/smartShop/copyToClipboard';
import { deliveryListOrderUrl, formatGroceryListPlainText } from '../../lib/smartShop/deliveryLinks';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';
import type { GroceryListItem } from '../../types/mealprep';
import { openGroceryItems } from '../../lib/smartShop/aggregateDeals';
import { OrderListDeliveryButtons } from './StoreDeliveryButtons';

type Props = {
  grocery: GroceryListItem[];
  onError: (message: string) => void;
};

export function SmartShopDeliveryBox({ grocery, onError }: Props) {
  const items = openGroceryItems(grocery);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function handleOrderList(service: DeliveryServiceId) {
    const text = formatGroceryListPlainText(items);
    await copyTextToClipboard(text);
    setClipboardToast(DELIVERY_CLIPBOARD_TOAST);
    setTimeout(() => setClipboardToast(null), 3500);
    try {
      await openExternalUrl(deliveryListOrderUrl(service));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not open delivery link');
    }
  }

  return (
    <View className="mt-3 rounded-2xl border border-border bg-card px-3 py-3">
      <Text className="text-xs font-bold uppercase tracking-wide text-muted">Delivery</Text>
      <Text className="mt-1 text-xs text-muted">{SMART_SHOP_COPY.deliveryBlurb}</Text>
      <OrderListDeliveryButtons onOrder={(service) => void handleOrderList(service)} />
      {clipboardToast ? (
        <Text className="mt-2 text-xs font-semibold text-success-dark">{clipboardToast}</Text>
      ) : null}
    </View>
  );
}
