export type NutriScoreGrade = 'a' | 'b' | 'c' | 'd' | 'e';

export interface OpenFoodFactsProduct {
  /** Barcode used for the lookup (13 digits for UPC/EAN-13 codes). */
  barcode: string;
  name: string;
  brand: string | null;
  /** Package size as printed, e.g. "500 g". */
  packageSize: string | null;
  imageUrl: string | null;
  /** Human-readable allergen names, e.g. ["milk", "soybeans"]. */
  allergens: string[];
  nutriScore: NutriScoreGrade | null;
  pageUrl: string;
}

export type OpenFoodFactsLookupResult =
  | { status: 'found'; product: OpenFoodFactsProduct }
  | { status: 'not_found' }
  | { status: 'invalid_barcode' }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string };
