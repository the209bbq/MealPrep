// Start a MealPlanatic Plus subscription: returns the URL of a Stripe-hosted Checkout page.
//
// Deploy: Actions -> "Deploy Supabase function" -> stripe-checkout (gateway JWT verification ON).
// Requires SQL migration: 20261009020000_billing_subscriptions.sql
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   STRIPE_SECRET_KEY  Stripe secret or restricted key (test key while testing)
//   APP_WEB_URL        https://mealplanatic.app/
// Provided by the platform: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// Stripe setup this relies on:
//   - Prices with lookup keys `plus_monthly` and `plus_yearly` (so test and live need no code change).
//   - A Terms of Service URL in Stripe's public business details; the required consent box
//     cannot be shown without it.
//
// Request:  POST { "interval": "month" | "year" }   (signed-in user)
// Response: 200 { "url": "https://checkout.stripe.com/..." }
//           409 { code: "ALREADY_SUBSCRIBED" } when the user already has a live subscription
//
// Rules this function keeps:
// - The price and the return URLs come from server configuration, never from the request.
// - The renewal wording is built from the real Stripe price, shown beside the pay button, and
//   its version is saved in the session metadata for the consent record the webhook writes.
// - The customer must tick an unticked box agreeing to automatic renewal before paying.

import {
  billingContextFromRequest,
  corsHeaders,
  findBillingRow,
  jsonResponse,
  StripeRequestError,
  stripeRequest,
} from '../_shared/billingServer.ts';
import {
  checkoutReturnUrls,
  consentCheckboxText,
  DISCLOSURE_VERSION,
  isLiveSubscriptionStatus,
  normalizeAppUrl,
  parseBillingInterval,
  PRICE_LOOKUP_KEYS,
  renewalDisclosure,
  TERMS_VERSION,
} from '../_shared/billingText.ts';

interface StripePrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval?: string } | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const context = await billingContextFromRequest(req);
  if (context instanceof Response) return context;
  const { admin, userId, userEmail, stripeSecretKey } = context;

  const appUrl = normalizeAppUrl(context.appUrlRaw);
  if (!appUrl) {
    return jsonResponse({ error: 'Billing is not set up yet.', code: 'NOT_CONFIGURED' }, 503);
  }

  let body: { interval?: unknown } = {};
  try {
    body = (await req.json()) as { interval?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
  }
  const interval = parseBillingInterval(body.interval);
  if (!interval) {
    return jsonResponse({ error: 'Choose a monthly or yearly plan.', code: 'BAD_REQUEST' }, 400);
  }

  try {
    const existing = await findBillingRow(admin, userId);
    if (existing && isLiveSubscriptionStatus(existing.status)) {
      return jsonResponse(
        { error: 'You already have MealPlanatic Plus. Use Manage subscription to make changes.', code: 'ALREADY_SUBSCRIBED' },
        409,
      );
    }

    // One Stripe customer per account, created once and remembered.
    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>(stripeSecretKey, 'POST', '/customers', {
        form: { email: userEmail, metadata: { supabase_user_id: userId } },
        idempotencyKey: `mp-customer-${userId}`,
      });
      customerId = customer.id;
      const { error: insertError } = await admin
        .from('billing_subscriptions')
        .upsert(
          { user_id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
          { onConflict: 'stripe_customer_id', ignoreDuplicates: true },
        );
      if (insertError) throw insertError;
    }

    const prices = await stripeRequest<{ data: StripePrice[] }>(stripeSecretKey, 'GET', '/prices', {
      form: { lookup_keys: [PRICE_LOOKUP_KEYS[interval]], active: true, limit: 1 },
    });
    const price = prices.data[0];
    if (!price || price.unit_amount === null || price.recurring?.interval !== interval) {
      console.error('stripe-checkout: no active price for lookup key', PRICE_LOOKUP_KEYS[interval]);
      return jsonResponse({ error: 'This plan is not available right now.', code: 'PRICE_NOT_FOUND' }, 503);
    }

    const urls = checkoutReturnUrls(appUrl);
    // Same button pressed twice within a minute returns the same Checkout page, not two.
    const minuteBucket = Math.floor(Date.now() / 60_000);

    const session = await stripeRequest<{ url: string | null }>(stripeSecretKey, 'POST', '/checkout/sessions', {
      form: {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: urls.success,
        cancel_url: urls.cancel,
        consent_collection: { terms_of_service: 'required' },
        custom_text: {
          submit: { message: renewalDisclosure(price.unit_amount, price.currency, interval) },
          terms_of_service_acceptance: {
            message: consentCheckboxText(price.unit_amount, price.currency, interval, urls.terms),
          },
        },
        metadata: {
          supabase_user_id: userId,
          price_id: price.id,
          billing_interval: interval,
          terms_version: TERMS_VERSION,
          disclosure_version: DISCLOSURE_VERSION,
        },
        subscription_data: {
          billing_mode: { type: 'flexible' },
          metadata: { supabase_user_id: userId },
        },
      },
      idempotencyKey: `mp-checkout-${userId}-${price.id}-${minuteBucket}`,
    });

    if (!session.url) {
      throw new Error('Stripe returned a Checkout Session without a URL');
    }
    return jsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof StripeRequestError) {
      console.error('stripe-checkout: Stripe error', error.status, error.stripeCode, error.message);
    } else {
      console.error('stripe-checkout failed', error);
    }
    return jsonResponse({ error: 'Could not start checkout. Please try again.', code: 'UPSTREAM_ERROR' }, 502);
  }
});
