import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { THEME } from '../../config/appConfig';
import { resolveStoreChainKey } from '../../config/weeklyAds';
import type { StoreLocation } from '../../lib/deals/types';
import { formatMoney } from '../../lib/smartShop/aggregateDeals';
import {
  addCommunityDeal,
  deleteCommunityDeal,
  formatReportedLight,
  voteCommunityDeal,
} from '../../lib/communityDeals/client';
import { isPastLocalDate, localDateString } from '../../lib/communityDeals/localDate';
import { getSupabase } from '../../lib/supabase';
import type { CommunityStoreDeal } from '../../lib/communityDeals/types';
import { ViewScanPhotoButton } from '../ViewScanPhotoButton';

interface StoreCommunityDealsSectionProps {
  store: StoreLocation;
  deals: CommunityStoreDeal[];
  loading?: boolean;
  tableMissing?: boolean;
  migrationHint?: string;
  onRefresh: () => void;
}

function defaultValidUntilIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + COMMUNITY_DEALS.defaultValidDays);
  return localDateString(d);
}

export function StoreCommunityDealsSection({
  store,
  deals,
  loading,
  tableMissing,
  migrationHint,
  onRefresh,
}: StoreCommunityDealsSectionProps) {
  const storeKey = resolveStoreChainKey(store);
  const storeDeals = useMemo(
    () => (storeKey ? deals.filter((d) => d.storeKey === storeKey) : []),
    [deals, storeKey],
  );

  const [expanded, setExpanded] = useState(storeDeals.length > 0);
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [validUntil, setValidUntil] = useState(defaultValidUntilIso);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void getSupabase()
      ?.auth.getSession()
      .then(({ data }) => setCurrentUserId(data.session?.user?.id ?? null));
  }, []);

  if (!storeKey) return null;

  async function handleDelete(dealId: string) {
    const res = await deleteCommunityDeal(dealId);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not delete deal');
      return;
    }
    setFormError(null);
    onRefresh();
  }

  async function handleVote(dealId: string, vote: 'confirm' | 'expired', reportedBy: string) {
    const res = await voteCommunityDeal(dealId, vote, { reportedBy });
    if (!res.ok) {
      setFormError(res.error ?? 'Could not save vote');
      return;
    }
    setFormError(null);
    onRefresh();
  }

  async function handleSubmitDeal() {
    const parsed = Number.parseFloat(price);
    if (!itemName.trim()) {
      setFormError('Enter an item name.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFormError('Enter a valid price.');
      return;
    }
    const until = validUntil.trim() || defaultValidUntilIso();
    if (isPastLocalDate(until)) {
      setFormError('Valid until must be today or a future date.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await addCommunityDeal({
      storeKey: storeKey as string,
      osmStoreId: store.id.startsWith('kroger-') ? undefined : store.id,
      storeName: store.name,
      itemName: itemName.trim(),
      price: parsed,
      unit: unit.trim() || undefined,
      note: note.trim() || undefined,
      validUntil: validUntil.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not add deal');
      return;
    }
    setItemName('');
    setPrice('');
    setUnit('');
    setNote('');
    setValidUntil(defaultValidUntilIso());
    setShowForm(false);
    onRefresh();
  }

  return (
    <View className="mt-3 border-t border-border pt-3">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center justify-between"
      >
        <Text className="text-sm font-bold text-ink">
          Deals ({storeDeals.length})
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.muted} />
      </Pressable>

      {tableMissing && migrationHint ? (
        <Text className="mt-2 text-xs text-amber-800">{migrationHint}</Text>
      ) : null}

      {expanded ? (
        <View className="mt-2">
          {loading ? (
            <View className="flex-row items-center gap-2 py-2">
              <ActivityIndicator size="small" color={THEME.success} />
              <Text className="text-xs text-muted">Loading community deals…</Text>
            </View>
          ) : null}

          {storeDeals.length === 0 && !loading ? (
            <Text className="text-xs text-muted">No community deals yet — add one below.</Text>
          ) : null}

          {storeDeals.map((deal) => {
            const expired =
              Boolean(deal.validUntil && isPastLocalDate(deal.validUntil)) ||
              deal.expiredCount >= COMMUNITY_DEALS.expiredVoteThreshold;
            const isOwn = currentUserId && deal.reportedBy === currentUserId;
            return (
            <View key={deal.id} className="mb-2 rounded-xl border border-border bg-paper px-3 py-2">
              <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-ink">{deal.itemName}</Text>
                  <Text className="text-sm font-bold text-success-dark">
                    {formatMoney(deal.price)}
                    {deal.unit ? ` / ${deal.unit}` : ''}
                  </Text>
                  {deal.note ? <Text className="mt-1 text-xs text-muted">{deal.note}</Text> : null}
                  <Text className="mt-1 text-xs text-muted">
                    {formatReportedLight(deal.createdAt)}
                    {deal.confirmCount ? ` · ${deal.confirmCount} confirmed` : ''}
                    {expired ? ' · Expired' : ''}
                  </Text>
                </View>
              </View>
              {!deal.isSample && !isOwn ? (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => void handleVote(deal.id, 'confirm', deal.reportedBy)}
                    className={`rounded-lg px-2 py-1 ${deal.myVote === 'confirm' ? 'bg-success' : 'bg-success-light'}`}
                  >
                    <Text
                      className={`text-xs font-semibold ${deal.myVote === 'confirm' ? 'text-on-success' : 'text-success-dark'}`}
                    >
                      Confirm
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleVote(deal.id, 'expired', deal.reportedBy)}
                    className={`rounded-lg px-2 py-1 ${deal.myVote === 'expired' ? 'bg-danger/20' : 'bg-paper'}`}
                  >
                    <Text className="text-xs font-semibold text-danger">Expired</Text>
                  </Pressable>
                </View>
              ) : null}
              {!deal.isSample && isOwn ? (
                <View className="mt-2">
                  <ViewScanPhotoButton scanPhotoPath={deal.scanPhotoPath} />
                  <Pressable
                    onPress={() => void handleDelete(deal.id)}
                    className="mt-2 self-start rounded-lg border border-danger/40 px-2 py-1"
                  >
                    <Text className="text-xs font-semibold text-danger">Delete</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
          })}

          {formError ? (
            <Text className="mb-2 text-xs text-danger">{formError}</Text>
          ) : null}

          {showForm ? (
            <View className="rounded-xl border border-border bg-paper p-3">
              <Text className="text-xs font-bold text-ink">Add a deal</Text>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                placeholder="Item name"
                placeholderTextColor={THEME.muted}
                className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
              />
              <View className="mt-2 flex-row gap-2">
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="Price"
                  keyboardType="decimal-pad"
                  placeholderTextColor={THEME.muted}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
                />
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="Unit (lb)"
                  placeholderTextColor={THEME.muted}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
                />
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Note (optional)"
                placeholderTextColor={THEME.muted}
                className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
              />
              <TextInput
                value={validUntil}
                onChangeText={setValidUntil}
                placeholder="Valid until (YYYY-MM-DD)"
                placeholderTextColor={THEME.muted}
                className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
              />
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  onPress={() => void handleSubmitDeal()}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-success px-3 py-2"
                >
                  <Text className="text-center text-xs font-bold text-on-success">
                    {submitting ? 'Saving…' : 'Post deal'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setShowForm(false)} className="rounded-xl border border-border px-3 py-2">
                  <Text className="text-xs font-semibold text-muted">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowForm(true)} className="mt-2 self-start">
              <Text className="text-xs font-bold text-success-dark">Add a deal</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
