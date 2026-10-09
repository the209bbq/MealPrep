export type CheckoutReturn = 'success' | 'cancel' | 'portal';

/** Reads `?checkout=success|cancel` or `?billing=return` from a query string. */
export function parseCheckoutReturn(search: string): CheckoutReturn | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const checkout = params.get('checkout');
  if (checkout === 'success') return 'success';
  if (checkout === 'cancel') return 'cancel';
  if (params.get('billing') === 'return') return 'portal';
  return null;
}

/** The same query string without the return markers, so a reload does not repeat the message. */
export function stripCheckoutReturn(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete('checkout');
  params.delete('billing');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/** Poll schedule after a successful checkout: the webhook usually lands within a few seconds. */
export const PLAN_UNLOCK_POLL = { intervalMs: 2_000, attempts: 10 } as const;

/** Only ever send the browser to Stripe's own pages. */
export function isStripeHostedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'checkout.stripe.com' || parsed.hostname === 'billing.stripe.com')
    );
  } catch {
    return false;
  }
}
