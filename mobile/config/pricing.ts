/**
 * MealPlanatic Plus prices as shown in the app.
 *
 * These are display values. The amount actually charged comes from the Stripe prices with
 * lookup keys `plus_monthly` and `plus_yearly`, and Stripe's checkout page repeats the real
 * price and renewal terms. If a Stripe price changes, change it here in the same pull request
 * and tell compliance first (subscription price changes need notice).
 */
export type BillingInterval = 'month' | 'year';

export const PLUS_PRICING: Record<BillingInterval, { unitAmount: number; currency: 'usd' }> = {
  month: { unitAmount: 699, currency: 'usd' },
  year: { unitAmount: 6000, currency: 'usd' },
};

/** Order shown on the upgrade screen; the first is selected by default. */
export const PLUS_INTERVAL_ORDER: readonly BillingInterval[] = ['year', 'month'];

export const PLUS_UPGRADE_COPY = {
  heading: 'MealPlanatic Plus',
  benefit: 'Scan your pantry, fridge and shelf tags with your camera instead of typing.',
  termsLinkLabel: 'See Terms.',
  notNow: 'Not now',
  signInToUpgrade: 'Sign in to upgrade',
  signInHint: 'Create a free account or sign in first, so Plus stays with you on every device.',
  starting: 'Opening secure checkout…',
  manage: 'Manage subscription',
  managing: 'Opening billing…',
  manageHint: 'Cancel, update your card or see invoices.',
  genericError: 'Could not start checkout. Please try again.',
  manageError: 'Could not open billing. Please try again.',
  alreadySubscribed: 'You already have MealPlanatic Plus. Use Manage subscription to make changes.',
  notConfigured: 'Plus is not available to buy yet. Please check back soon.',
  /** Shown when Plus came from us rather than a subscription. */
  compedBlurb: 'Plus is on for your account. There is no subscription and nothing to pay.',
} as const;

export const CHECKOUT_RETURN_COPY = {
  unlocked: "You're on MealPlanatic Plus. Photo scanning is unlocked.",
  pending: 'Payment received. Plus will unlock in a moment; reopen the app if it does not.',
  cancelled: 'Checkout closed. You have not been charged.',
} as const;
