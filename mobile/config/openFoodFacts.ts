import { SUPPORT_EMAIL } from './support';

/**
 * Open Food Facts product lookup by barcode (free, no API key).
 * @see https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
 *
 * Rules from their docs that shape this client:
 * - Reads need no auth, only an identifying User-Agent (`AppName/Version (ContactEmail)`).
 * - Product reads are limited to 15 requests/min per IP; when calls come straight from a user's
 *   device the limit applies per user. Do NOT proxy through one shared server IP.
 * - Browsers cannot set a User-Agent, so the header is only sent on native.
 * - Data is ODbL / DbCL and images CC BY-SA: always show the credit line next to the data.
 */
export const OPEN_FOOD_FACTS = {
  /** Production host (the `.net` host is their staging server). */
  baseUrl: 'https://world.openfoodfacts.org',
  siteUrl: 'https://world.openfoodfacts.org',
  requestTimeoutMs: 12_000,
  /** Product details rarely change; cache lookups (including not-found) per session. */
  cacheTtlMs: 24 * 60 * 60 * 1000,
  maxCacheEntries: 200,
  /** Only ask for what the pantry needs (keeps responses small and fast). */
  fields: [
    'code',
    'product_name',
    'generic_name',
    'brands',
    'quantity',
    'image_front_small_url',
    'allergens_tags',
    'nutriscore_grade',
    'nutrition_grades',
  ],
  /** Identifies this app to Open Food Facts. Uses the support inbox as the contact address. */
  userAgent: `MealPlanatic/1.0 (${SUPPORT_EMAIL})`,
} as const;

export const OPEN_FOOD_FACTS_COPY = {
  sectionLabel: 'Barcode',
  inputPlaceholder: 'Scan or type a barcode',
  lookupButton: 'Look up',
  lookingUp: 'Looking up…',
  attribution: 'Product data from',
  attributionLinkLabel: 'Open Food Facts',
  attributionAccessibility: 'View Open Food Facts',
  foundPrefix: 'Found:',
  allergensPrefix: 'Contains:',
  allergensNote: 'Community-reported. Always check the package.',
  invalidBarcode: "That doesn't look like a valid barcode. Check the digits and try again.",
  notFound: "Not in Open Food Facts yet. Enter the item name yourself.",
  rateLimited: 'Too many lookups right now. Wait a minute and try again.',
  error: "Couldn't look that up right now. You can still enter the name yourself.",
} as const;

export function openFoodFactsProductApiUrl(barcode: string): string {
  const fields = OPEN_FOOD_FACTS.fields.join(',');
  return `${OPEN_FOOD_FACTS.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(fields)}`;
}

export function openFoodFactsProductPageUrl(barcode: string): string {
  return `${OPEN_FOOD_FACTS.siteUrl}/product/${encodeURIComponent(barcode)}`;
}
