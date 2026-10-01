import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SMART_SHOP_COPY } from '../../config/smartShop';
import { THEME } from '../../config/appConfig';
import { addCommunityDeal } from '../../lib/communityDeals/client';
import { isPastLocalDate } from '../../lib/communityDeals/localDate';
import type { StoreLocation } from '../../lib/deals/types';
import { preparePantryImage } from '../../lib/pantryVision/prepareImage';
import {
  PantryVisionAuthError,
  PantryVisionNotConfiguredError,
  PantryVisionRateLimitError,
  PantryVisionScanError,
} from '../../lib/pantryVision/client';
import { analyzePriceTagPhoto } from '../../lib/priceTagVision/client';
import { getSupabase } from '../../lib/supabase';
import { resolveStoreChainKey } from '../../config/weeklyAds';

export type SmartShopAddPriceTarget = {
  store: StoreLocation;
  itemName?: string;
};

type Props = {
  target: SmartShopAddPriceTarget | null;
  onClose: () => void;
  onSaved: () => void;
};

export function SmartShopAddPriceSheet({ target, onClose, onSaved }: Props) {
  const visible = Boolean(target);
  const store = target?.store;

  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [sizeUnit, setSizeUnit] = useState('');
  const [saleUntil, setSaleUntil] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!target) return;
    setItemName(target.itemName?.trim() ?? '');
    setPrice('');
    setSizeUnit('');
    setSaleUntil('');
    setError(null);
    void getSupabase()
      ?.auth.getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session?.user?.id)));
  }, [target]);

  async function handleSave() {
    if (!store) return;
    const parsed = Number.parseFloat(price);
    if (!itemName.trim()) {
      setError('Enter an item name.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid price.');
      return;
    }
    const sale = saleUntil.trim();
    if (sale && isPastLocalDate(sale)) {
      setError('Sale end date must be today or later.');
      return;
    }

    const storeKey = resolveStoreChainKey(store);
    if (!storeKey) {
      setError('This store cannot accept prices yet.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await addCommunityDeal({
      storeKey,
      osmStoreId: store.id.startsWith('kroger-') ? undefined : store.id,
      storeName: store.name,
      itemName: itemName.trim(),
      price: parsed,
      unit: sizeUnit.trim() || undefined,
      saleValidUntil: sale || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save price.');
      return;
    }
    onSaved();
    onClose();
  }

  async function runScan(prepared: { base64: string; mimeType: string }) {
    setScanning(true);
    setError(null);
    try {
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token ?? null;
      const result = await analyzePriceTagPhoto(
        {
          uri: '',
          base64: prepared.base64,
          mimeType: prepared.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
          byteLength: Math.floor((prepared.base64.length * 3) / 4),
        },
        token,
      );
      if (result.itemName) setItemName(result.itemName);
      if (Number.isFinite(result.price)) setPrice(String(result.price));
      if (result.sizeUnit) setSizeUnit(result.sizeUnit);
      if (result.saleValidUntil) setSaleUntil(result.saleValidUntil);
    } catch (err) {
      if (err instanceof PantryVisionNotConfiguredError) {
        setError(SMART_SHOP_COPY.addPriceScanNotConfigured);
      } else if (err instanceof PantryVisionAuthError) {
        setError(SMART_SHOP_COPY.addPriceSignIn);
      } else if (err instanceof PantryVisionRateLimitError) {
        setError(err.message);
      } else if (err instanceof PantryVisionScanError) {
        setError(err.message);
      } else {
        setError(SMART_SHOP_COPY.addPriceScanFailed);
      }
    } finally {
      setScanning(false);
    }
  }

  async function handleSnapTag() {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        void import('../../lib/pantryVision/prepareImage.web')
          .then(({ preparePantryImageFromFile }) => preparePantryImageFromFile(file))
          .then((prepared) => runScan(prepared))
          .catch(() => setError(SMART_SHOP_COPY.addPriceScanFailed));
      };
      input.click();
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is needed to scan a shelf tag.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    try {
      const prepared = await preparePantryImage(result.assets[0].uri);
      await runScan(prepared);
    } catch {
      setError(SMART_SHOP_COPY.addPriceScanFailed);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl border border-border bg-paper px-4 pb-8 pt-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink">{SMART_SHOP_COPY.addPriceSheetTitle}</Text>
            <Pressable onPress={onClose} className="rounded-full p-2">
              <Ionicons name="close" size={22} color={THEME.muted} />
            </Pressable>
          </View>
          {store ? (
            <Text className="mb-3 text-sm text-muted">{store.chain || store.name}</Text>
          ) : null}

          {signedIn === false ? (
            <Text className="mb-3 text-sm text-amber-900">{SMART_SHOP_COPY.addPriceSignIn}</Text>
          ) : null}

          <Text className="text-xs font-bold text-muted">{SMART_SHOP_COPY.addPriceItemLabel}</Text>
          <TextInput
            value={itemName}
            onChangeText={setItemName}
            placeholder="Item on your list"
            placeholderTextColor={THEME.muted}
            className="mt-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
          />

          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Text className="text-xs font-bold text-muted">{SMART_SHOP_COPY.addPricePriceLabel}</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={THEME.muted}
                className="mt-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-muted">{SMART_SHOP_COPY.addPriceSizeLabel}</Text>
              <TextInput
                value={sizeUnit}
                onChangeText={setSizeUnit}
                placeholder={SMART_SHOP_COPY.addPriceSizePlaceholder}
                placeholderTextColor={THEME.muted}
                className="mt-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
              />
            </View>
          </View>

          <Text className="mt-3 text-xs font-bold text-muted">{SMART_SHOP_COPY.addPriceSaleUntilLabel}</Text>
          <TextInput
            value={saleUntil}
            onChangeText={setSaleUntil}
            placeholder={SMART_SHOP_COPY.addPriceSaleUntilPlaceholder}
            placeholderTextColor={THEME.muted}
            className="mt-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
          />

          {error ? <Text className="mt-2 text-xs text-danger">{error}</Text> : null}

          <Pressable
            onPress={() => void handleSnapTag()}
            disabled={scanning || submitting}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-emerald bg-emerald-light/40 px-3 py-3"
          >
            {scanning ? (
              <ActivityIndicator size="small" color={THEME.emerald} />
            ) : (
              <Ionicons name="camera-outline" size={20} color={THEME.emerald} />
            )}
            <Text className="text-sm font-bold text-emerald-dark">
              {scanning ? SMART_SHOP_COPY.addPriceScanning : SMART_SHOP_COPY.addPriceScanTag}
            </Text>
          </Pressable>

          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={() => void handleSave()}
              disabled={submitting || scanning || signedIn === false}
              className="flex-1 rounded-xl bg-emerald px-3 py-3"
            >
              <Text className="text-center text-sm font-bold text-on-emerald">
                {submitting ? 'Saving…' : SMART_SHOP_COPY.addPriceSave}
              </Text>
            </Pressable>
            <Pressable onPress={onClose} className="rounded-xl border border-border px-4 py-3">
              <Text className="text-sm font-semibold text-muted">{SMART_SHOP_COPY.addPriceCancel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
