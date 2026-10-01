export type StoreDealVoteKind = 'confirm' | 'expired';

export interface StoreDealVoteRow {
  dealId: string;
  userId: string;
  vote: StoreDealVoteKind;
}

export type CommunityPriceKind = 'regular' | 'sale';

export interface CommunityStoreDeal {
  id: string;
  storeKey: string;
  osmStoreId?: string;
  storeName?: string;
  itemName: string;
  price: number;
  unit?: string;
  note?: string;
  priceKind?: CommunityPriceKind;
  validUntil?: string;
  reportedBy: string;
  createdAt: string;
  confirmCount: number;
  expiredCount: number;
  myVote?: StoreDealVoteKind;
  isSample?: boolean;
}

export interface AddCommunityDealInput {
  storeKey: string;
  osmStoreId?: string;
  storeName?: string;
  itemName: string;
  price: number;
  unit?: string;
  note?: string;
  validUntil?: string;
  /** When set, item is on sale until this date (YYYY-MM-DD). Omit for a regular shelf price. */
  saleValidUntil?: string | null;
}

export interface FetchCommunityDealsResult {
  deals: CommunityStoreDeal[];
  tableMissing: boolean;
  hint?: string;
}
