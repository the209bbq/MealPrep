export type StoreDealVoteKind = 'confirm' | 'expired';

export interface StoreDealVoteRow {
  dealId: string;
  userId: string;
  vote: StoreDealVoteKind;
}

export interface CommunityStoreDeal {
  id: string;
  storeKey: string;
  osmStoreId?: string;
  storeName?: string;
  itemName: string;
  price: number;
  unit?: string;
  note?: string;
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
}

export interface FetchCommunityDealsResult {
  deals: CommunityStoreDeal[];
  tableMissing: boolean;
  hint?: string;
}
