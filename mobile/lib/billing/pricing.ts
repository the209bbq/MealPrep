import { PLUS_PRICING, type BillingInterval } from '../../config/pricing';

/** 699 -> "$6.99", 6000 -> "$60". */
export function formatPlusPrice(interval: BillingInterval): string {
  const { unitAmount } = PLUS_PRICING[interval];
  const major = unitAmount / 100;
  return `$${Number.isInteger(major) ? String(major) : major.toFixed(2)}`;
}

function periodWords(interval: BillingInterval): { a: string; every: string } {
  return interval === 'year' ? { a: 'a year', every: 'every year' } : { a: 'a month', every: 'every month' };
}

/** "$60 a year" / "$6.99 a month" */
export function plusPriceLabel(interval: BillingInterval): string {
  return `${formatPlusPrice(interval)} ${periodWords(interval).a}`;
}

/** The buy button says exactly what it does and what it costs. */
export function plusSubscribeLabel(interval: BillingInterval): string {
  return `Subscribe for ${plusPriceLabel(interval)}`;
}

/**
 * Renewal terms shown directly above the buy button: price, renewal period, how to cancel.
 * Must stay word-for-word the same as `renewalDisclosure` in
 * supabase/functions/_shared/billingText.ts (checked by scripts/plus-upgrade-ui-check.ts).
 */
export function plusRenewalDisclosure(interval: BillingInterval): string {
  const period = periodWords(interval);
  return (
    `MealPlanatic Plus is ${formatPlusPrice(interval)} ${period.a}. ` +
    `It renews automatically ${period.every} until you cancel. ` +
    'Cancel any time in Account, Manage subscription.'
  );
}
