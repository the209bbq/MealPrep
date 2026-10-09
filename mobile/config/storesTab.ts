/** Stores tab — nearby grocery discovery (Oakdale / 209 default area). */

/** Default ZIP when the user has not set a home location (built-in geocode table). */
export const STORES_TAB_DEFAULT_ZIP = '95361';

/** Max stores shown on the Stores tab (closest first after merge). */
export const STORES_TAB_DISPLAY_LIMIT = 15;

export const STORES_TAB_COPY = {
  title: 'Stores near you',
  nearPrefix: 'Near',
  changeLocation: 'Change',
  changeLocationA11y: 'Change location',
  searchPlaceholder: 'Search stores',
  emptySearch: 'No stores match your search.',
  loading: 'Finding nearby grocery stores…',
  updating: 'Updating nearby stores…',
  loadFailed: 'Could not load stores. Check your connection and try again.',
  retry: 'Try again',
  noStores: 'No stores found nearby yet.',
  widenSearch: 'Try a wider area',
  findStoresTitle: 'Find stores near you',
  useMyLocation: 'Use my location',
  enterZip: 'Enter ZIP',
  zipShort: 'ZIP code',
  locationDeniedHelp:
    'Location is off. Tap the lock icon in the address bar, open Permissions, and turn on Location — or enter a ZIP below.',
  nearYourLocation: 'your location',
  attribution: 'Store data © OpenStreetMap contributors, Overture Maps Foundation',
  openNow: 'Open now',
  closedNow: 'Closed',
  detailDirections: 'Directions',
  detailCall: 'Call',
  detailStorePage: 'Store page',
  detailViewOnGoogleMaps: 'View on Google Maps',
  detailWeeklyAd: 'Weekly ad',
  detailWeeklyAdThirdParty: 'Weekly ad (third-party)',
  detailGetDelivered: 'Get it delivered',
  deliveryInstacart: 'Instacart',
  deliveryDoordash: 'DoorDash',
  deliveryUbereats: 'Uber Eats',
  detailWebsite: 'Website',
  detailOrderOnline: 'Order online',
  noPricesYet: 'No prices yet',
  locationModalTitle: 'Stores near you',
} as const;
