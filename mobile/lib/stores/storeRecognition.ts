import { resolveGroceryChainFromHaystack } from './groceryFilter';

/**
 * Stores tab grouping: recognised chains and brands are listed first; unbranded
 * rows from the open store data sit behind "More local markets".
 *
 * The open data (Overture Places) labels plenty of farms, wholesalers and closed
 * businesses as grocery stores, and those rows almost never carry a brand. A
 * known chain name or a brand on the row is the best signal available on the
 * client that a shopper can actually buy a week's groceries there.
 */
export type RecognizableStore = {
  name: string;
  chain: string;
  source?: 'osm' | 'manual' | 'kroger';
  krogerLocationId?: string;
  knownBrand?: boolean;
};

export function isRecognizedStore(store: RecognizableStore): boolean {
  if (store.knownBrand) return true;
  // Kroger rows come from Kroger's own location feed; manual rows are stores the shopper saved.
  if (store.krogerLocationId || store.source === 'kroger' || store.source === 'manual') return true;
  return resolveGroceryChainFromHaystack(`${store.name} ${store.chain}`.toLowerCase()) != null;
}

export function splitStoresByRecognition<T extends RecognizableStore>(
  stores: readonly T[],
): { recognized: T[]; local: T[] } {
  const recognized: T[] = [];
  const local: T[] = [];
  for (const store of stores) {
    (isRecognizedStore(store) ? recognized : local).push(store);
  }
  return { recognized, local };
}
