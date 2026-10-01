import { COMMUNITY_DEALS } from '../../config/communityDeals';
import { isDemoMode } from '../../config/appConfig';
import { getSupabase } from '../supabase';
import { demoCommunityDeals } from './demoSamples';
import { isPastLocalDate, localDateString } from './localDate';
import { resolvePriceValidity } from './priceValidity';
import type { CommunityPriceKind } from './types';
import type {
  AddCommunityDealInput,
  CommunityStoreDeal,
  FetchCommunityDealsResult,
  StoreDealVoteKind,
} from './types';

type DealRow = {
  id: string;
  store_key: string;
  osm_store_id: string | null;
  store_name: string | null;
  item_name: string;
  price: number;
  unit: string | null;
  note: string | null;
  valid_until: string | null;
  price_kind: string | null;
  reported_by: string;
  created_at: string;
};

type VoteRow = {
  deal_id: string;
  user_id: string;
  vote: StoreDealVoteKind;
};

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST205') return true;
  return /store_deals/i.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? '');
}

function mapDealRow(
  row: DealRow,
  votes: VoteRow[],
  currentUserId: string | null,
): CommunityStoreDeal {
  const dealVotes = votes.filter((v) => v.deal_id === row.id);
  const confirmCount = dealVotes.filter((v) => v.vote === 'confirm').length;
  const expiredCount = dealVotes.filter((v) => v.vote === 'expired').length;
  const myVote = currentUserId
    ? dealVotes.find((v) => v.user_id === currentUserId)?.vote
    : undefined;

  return {
    id: row.id,
    storeKey: row.store_key,
    osmStoreId: row.osm_store_id ?? undefined,
    storeName: row.store_name ?? undefined,
    itemName: row.item_name,
    price: Number(row.price),
    unit: row.unit ?? undefined,
    note: row.note ?? undefined,
    validUntil: row.valid_until ?? undefined,
    priceKind: (row.price_kind === 'sale' ? 'sale' : 'regular') as CommunityPriceKind,
    reportedBy: row.reported_by,
    createdAt: row.created_at,
    confirmCount,
    expiredCount,
    myVote,
  };
}

export function filterVisibleCommunityDeals(
  deals: CommunityStoreDeal[],
  currentUserId?: string | null,
): CommunityStoreDeal[] {
  const today = localDateString();
  return deals.filter((deal) => {
    if (deal.validUntil && isPastLocalDate(deal.validUntil, today)) {
      return Boolean(currentUserId && deal.reportedBy === currentUserId);
    }
    if (deal.expiredCount >= COMMUNITY_DEALS.expiredVoteThreshold) return false;
    return true;
  });
}

export async function fetchCommunityDealsForStoreKeys(storeKeys: string[]): Promise<FetchCommunityDealsResult> {
  const uniqueKeys = [...new Set(storeKeys.filter(Boolean))];
  if (uniqueKeys.length === 0) {
    return { deals: [], tableMissing: false };
  }

  if (isDemoMode()) {
    return { deals: filterVisibleCommunityDeals(demoCommunityDeals(uniqueKeys), null), tableMissing: false };
  }

  const client = getSupabase();
  if (!client) {
    return { deals: filterVisibleCommunityDeals(demoCommunityDeals(uniqueKeys), null), tableMissing: false };
  }

  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;
  if (!userId) {
    return { deals: filterVisibleCommunityDeals(demoCommunityDeals(uniqueKeys), null), tableMissing: false };
  }

  const { data: dealRows, error: dealsError } = await client
    .from('store_deals')
    .select(
      'id, store_key, osm_store_id, store_name, item_name, price, unit, note, valid_until, price_kind, reported_by, created_at',
    )
    .in('store_key', uniqueKeys)
    .order('created_at', { ascending: false });

  if (isMissingTableError(dealsError)) {
    return {
      deals: filterVisibleCommunityDeals(demoCommunityDeals(uniqueKeys), userId),
      tableMissing: true,
      hint: COMMUNITY_DEALS.migrationHint,
    };
  }

  if (dealsError || !dealRows?.length) {
    return { deals: [], tableMissing: false };
  }

  const ids = dealRows.map((r) => (r as DealRow).id);
  const { data: voteRows, error: votesError } = await client
    .from('store_deal_votes')
    .select('deal_id, user_id, vote')
    .in('deal_id', ids);

  if (isMissingTableError(votesError)) {
    return {
      deals: filterVisibleCommunityDeals(demoCommunityDeals(uniqueKeys), userId),
      tableMissing: true,
      hint: COMMUNITY_DEALS.migrationHint,
    };
  }

  const votes = (voteRows ?? []) as VoteRow[];
  const mapped = (dealRows as DealRow[]).map((row) => mapDealRow(row, votes, userId));
  return { deals: filterVisibleCommunityDeals(mapped, userId), tableMissing: false };
}

export async function addCommunityDeal(input: AddCommunityDealInput): Promise<{ ok: boolean; error?: string }> {
  if (isDemoMode()) {
    return { ok: false, error: 'Sign in to report prices (demo shows sample prices only).' };
  }

  const client = getSupabase();
  if (!client) return { ok: false, error: 'Sign in to report a price.' };

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, error: 'Sign in to add a community deal.' };

  const { priceKind, validUntil } = resolvePriceValidity({
    saleValidUntil: input.saleValidUntil ?? input.validUntil,
  });

  if (isPastLocalDate(validUntil)) {
    return { ok: false, error: 'Sale end date must be today or later.' };
  }

  const { error } = await client.from('store_deals').insert({
    store_key: input.storeKey,
    osm_store_id: input.osmStoreId ?? null,
    store_name: input.storeName ?? null,
    item_name: input.itemName.trim(),
    price: input.price,
    unit: input.unit?.trim() || null,
    note: input.note?.trim() || null,
    valid_until: validUntil,
    price_kind: priceKind,
    reported_by: userId,
  });

  if (isMissingTableError(error)) {
    return { ok: false, error: COMMUNITY_DEALS.migrationHint };
  }
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function deleteCommunityDeal(dealId: string): Promise<{ ok: boolean; error?: string }> {
  if (isDemoMode()) {
    return { ok: false, error: 'Sign in to manage prices (demo shows sample prices only).' };
  }

  const client = getSupabase();
  if (!client) return { ok: false, error: 'Sign in to delete this price.' };

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, error: 'Sign in to delete a deal.' };

  const { error } = await client.from('store_deals').delete().eq('id', dealId).eq('reported_by', userId);

  if (isMissingTableError(error)) {
    return { ok: false, error: COMMUNITY_DEALS.migrationHint };
  }
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function voteCommunityDeal(
  dealId: string,
  vote: StoreDealVoteKind,
): Promise<{ ok: boolean; error?: string }> {
  if (isDemoMode()) {
    return { ok: false, error: 'Votes are disabled in demo mode.' };
  }

  const client = getSupabase();
  if (!client) return { ok: false, error: 'Sign in to vote on prices.' };

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, error: 'Sign in to vote on prices.' };

  const { error } = await client.from('store_deal_votes').upsert(
    { deal_id: dealId, user_id: userId, vote },
    { onConflict: 'deal_id,user_id' },
  );

  if (isMissingTableError(error)) {
    return { ok: false, error: COMMUNITY_DEALS.migrationHint };
  }
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export function formatReportedLight(iso: string): string {
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return 'Reported recently';
  const today = localDateString();
  const reportedDay = localDateString(then);
  if (reportedDay === today) return 'Reported today';
  return `Reported ${formatReportedAgo(iso)}`;
}

export function formatReportedAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'recently';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
