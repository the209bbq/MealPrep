/** Grams per US cup for volume ↔ weight when prorating package sizes. */
const GRAMS_PER_CUP: Record<string, number> = {
  flour: 120,
  'all purpose flour': 120,
  'bread flour': 127,
  sugar: 200,
  'brown sugar': 220,
  'powdered sugar': 120,
  rice: 185,
  'white rice': 185,
  'brown rice': 190,
  oats: 80,
  'rolled oats': 80,
  butter: 227,
  milk: 244,
  water: 236,
  oil: 218,
  'olive oil': 218,
  'vegetable oil': 218,
  honey: 340,
  cocoa: 85,
  cornmeal: 120,
  breadcrumbs: 108,
  cheese: 113,
  'parmesan cheese': 100,
  yogurt: 245,
  sour_cream: 230,
  cream: 240,
  'heavy cream': 238,
  onion: 160,
  'diced onion': 160,
};

export function gramsPerCupForKey(priceKey: string): number | null {
  const direct = GRAMS_PER_CUP[priceKey];
  if (direct) return direct;
  const normalized = priceKey.replace(/_/g, ' ');
  return GRAMS_PER_CUP[normalized] ?? null;
}
