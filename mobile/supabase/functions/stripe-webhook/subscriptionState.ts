// Pure helpers that turn Stripe objects into the rows stripe-webhook stores.
// No network or database access here so they can be unit-tested.

/** Stripe subscription statuses that keep MealPlanatic Plus on. Mirrors recompute_user_plan(). */
export const PLUS_ACTIVE_STATUSES = ['active', 'trialing', 'past_due'] as const;

export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(type: unknown): type is HandledEventType {
  return typeof type === 'string' && (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

export function isPlusActiveStatus(status: string | null | undefined): boolean {
  return typeof status === 'string' && (PLUS_ACTIVE_STATUSES as readonly string[]).includes(status);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function asUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Stripe sends related objects either as an id string or as an expanded object with `id`. */
export function stripeId(value: unknown): string | null {
  if (typeof value === 'string') return asNonEmptyString(value);
  if (value && typeof value === 'object') return asNonEmptyString((value as { id?: unknown }).id);
  return null;
}

function unixToIso(value: unknown): string | null {
  const seconds = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export interface SubscriptionRow {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  price_id: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** From subscription metadata, set by stripe-checkout. Null when absent or not a UUID. */
  metadata_user_id: string | null;
}

/**
 * Reads the fields we store from a Stripe Subscription object.
 * `current_period_end` lives on the subscription in older API versions and on the first
 * subscription item in newer ones; both are accepted.
 */
export function subscriptionRowFromStripe(subscription: unknown): SubscriptionRow | null {
  if (!subscription || typeof subscription !== 'object') return null;
  const sub = subscription as Record<string, unknown>;

  const subscriptionId = asNonEmptyString(sub.id);
  const customerId = stripeId(sub.customer);
  const status = asNonEmptyString(sub.status);
  if (!subscriptionId || !customerId || !status) return null;

  const items = (sub.items as { data?: unknown } | undefined)?.data;
  const firstItem =
    Array.isArray(items) && items[0] && typeof items[0] === 'object'
      ? (items[0] as Record<string, unknown>)
      : null;
  const price =
    firstItem?.price && typeof firstItem.price === 'object'
      ? (firstItem.price as Record<string, unknown>)
      : null;
  const recurring =
    price?.recurring && typeof price.recurring === 'object'
      ? (price.recurring as Record<string, unknown>)
      : null;
  const metadata =
    sub.metadata && typeof sub.metadata === 'object' ? (sub.metadata as Record<string, unknown>) : {};

  return {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status,
    price_id: price ? asNonEmptyString(price.id) : null,
    billing_interval: recurring ? asNonEmptyString(recurring.interval) : null,
    current_period_end:
      unixToIso(sub.current_period_end) ?? unixToIso(firstItem?.current_period_end) ?? null,
    cancel_at_period_end: sub.cancel_at_period_end === true,
    metadata_user_id: asUuid(metadata.supabase_user_id),
  };
}

/**
 * A customer has one stored row. If a late event for an OLD, ended subscription arrives after a
 * NEW subscription is already live for the same customer, it must not overwrite the live one.
 */
export function shouldApplySubscriptionUpdate(
  existing: { stripe_subscription_id: string | null; status: string | null } | null,
  incoming: Pick<SubscriptionRow, 'stripe_subscription_id' | 'status'>,
): boolean {
  if (!existing || !existing.stripe_subscription_id) return true;
  if (existing.stripe_subscription_id === incoming.stripe_subscription_id) return true;
  if (isPlusActiveStatus(existing.status) && !isPlusActiveStatus(incoming.status)) return false;
  return true;
}

export interface ConsentRow {
  user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string;
  price_id: string | null;
  billing_interval: string | null;
  amount_cents: number | null;
  currency: string | null;
  terms_version: string | null;
  disclosure_version: string | null;
  consented_at: string;
}

/**
 * Builds the consent record from a completed Checkout Session (subscription mode only).
 * stripe-checkout puts the user id in `client_reference_id` and the wording versions and
 * price details in `metadata`.
 */
export function consentRowFromCheckoutSession(session: unknown, nowIso: string): ConsentRow | null {
  if (!session || typeof session !== 'object') return null;
  const s = session as Record<string, unknown>;
  const sessionId = asNonEmptyString(s.id);
  if (!sessionId || s.mode !== 'subscription') return null;

  const metadata =
    s.metadata && typeof s.metadata === 'object' ? (s.metadata as Record<string, unknown>) : {};
  const amount = typeof s.amount_total === 'number' && Number.isFinite(s.amount_total) ? s.amount_total : null;

  return {
    user_id: asUuid(s.client_reference_id) ?? asUuid(metadata.supabase_user_id),
    stripe_customer_id: stripeId(s.customer),
    stripe_subscription_id: stripeId(s.subscription),
    stripe_checkout_session_id: sessionId,
    price_id: asNonEmptyString(metadata.price_id),
    billing_interval: asNonEmptyString(metadata.billing_interval),
    amount_cents: amount,
    currency: asNonEmptyString(s.currency),
    terms_version: asNonEmptyString(metadata.terms_version),
    disclosure_version: asNonEmptyString(metadata.disclosure_version),
    consented_at: unixToIso(s.created) ?? nowIso,
  };
}
