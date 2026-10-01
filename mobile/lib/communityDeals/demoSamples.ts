import { COMMUNITY_DEALS } from '../../config/communityDeals';
import type { CommunityStoreDeal } from './types';

/** Demo community deals when Supabase is not configured. */
export function demoCommunityDeals(storeKeys: string[]): CommunityStoreDeal[] {
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + COMMUNITY_DEALS.defaultValidDays);

  const samples: Omit<CommunityStoreDeal, 'storeKey'>[] = [
    {
      id: 'sample-deal-1',
      itemName: 'boneless chicken breast',
      price: 1.99,
      unit: 'lb',
      note: 'SAMPLE — demo only',
      validUntil: validUntil.toISOString().slice(0, 10),
      reportedBy: 'demo',
      createdAt: now.toISOString(),
      confirmCount: 2,
      expiredCount: 0,
      isSample: true,
    },
    {
      id: 'sample-deal-2',
      itemName: 'large eggs',
      price: 2.49,
      unit: 'dozen',
      note: 'SAMPLE community deal',
      validUntil: validUntil.toISOString().slice(0, 10),
      reportedBy: 'demo',
      createdAt: now.toISOString(),
      confirmCount: 1,
      expiredCount: 0,
      isSample: true,
    },
    {
      id: 'sample-deal-3',
      itemName: 'ground beef',
      price: 3.99,
      unit: 'lb',
      validUntil: validUntil.toISOString().slice(0, 10),
      reportedBy: 'demo',
      createdAt: now.toISOString(),
      confirmCount: 0,
      expiredCount: 0,
      isSample: true,
    },
  ];

  const keys = storeKeys.length > 0 ? storeKeys : ['save_mart', 'winco', 'safeway'];
  const deals: CommunityStoreDeal[] = [];
  keys.forEach((storeKey, index) => {
    const sample = samples[index % samples.length];
    deals.push({
      ...sample,
      id: `${sample.id}-${storeKey}`,
      storeKey,
      storeName: storeKey.replace(/_/g, ' '),
    });
  });
  return deals;
}
