import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeStripeSignature,
  constantTimeEqual,
  parseStripeSignatureHeader,
  verifyStripeSignature,
} from '../supabase/functions/stripe-webhook/signature.ts';
import {
  asUuid,
  consentRowFromCheckoutSession,
  isHandledEventType,
  isPlusActiveStatus,
  PLUS_ACTIVE_STATUSES,
  shouldApplySubscriptionUpdate,
  stripeId,
  subscriptionRowFromStripe,
} from '../supabase/functions/stripe-webhook/subscriptionState.ts';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = 'whsec_test_secret_for_unit_checks';
const USER = '3f2b8c1e-9d4a-4b6f-8a21-0c5d7e9f1a2b';

function sign(timestamp: number, body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function testSignature(): Promise<void> {
  const body = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated' });
  const now = 1_800_000_000;
  const good = sign(now, body);

  // Matches Node's own HMAC, so the Web Crypto path is computing the right thing.
  assert.equal(await computeStripeSignature(SECRET, now, body), good);

  const ok = await verifyStripeSignature({
    secret: SECRET,
    header: `t=${now},v1=${good}`,
    rawBody: body,
    nowSeconds: now + 10,
  });
  assert.deepEqual(ok, { ok: true, timestamp: now });

  // Secret rotation: Stripe may send several v1 values; any valid one passes.
  const rotated = await verifyStripeSignature({
    secret: SECRET,
    header: `t=${now},v1=${'0'.repeat(64)},v1=${good},v0=ignored`,
    rawBody: body,
    nowSeconds: now,
  });
  assert.equal(rotated.ok, true);

  const cases: Array<[string, string | null, string, number, string]> = [
    ['missing header', null, body, now, 'missing_header'],
    ['no v1', `t=${now}`, body, now, 'malformed_header'],
    ['garbage', 'not-a-signature', body, now, 'malformed_header'],
    ['short hex', `t=${now},v1=abc123`, body, now, 'malformed_header'],
    ['wrong secret', `t=${now},v1=${sign(now, body, 'whsec_other')}`, body, now, 'mismatch'],
    ['tampered body', `t=${now},v1=${good}`, body.replace('evt_1', 'evt_2'), now, 'mismatch'],
    ['replayed timestamp', `t=${now + 1},v1=${good}`, body, now, 'mismatch'],
    ['too old', `t=${now},v1=${good}`, body, now + 301, 'stale'],
    ['from the future', `t=${now},v1=${good}`, body, now - 301, 'stale'],
  ];
  for (const [label, header, rawBody, nowSeconds, reason] of cases) {
    const result = await verifyStripeSignature({ secret: SECRET, header, rawBody, nowSeconds });
    assert.deepEqual(result, { ok: false, reason }, label);
  }

  const noSecret = await verifyStripeSignature({
    secret: '   ',
    header: `t=${now},v1=${good}`,
    rawBody: body,
    nowSeconds: now,
  });
  assert.deepEqual(noSecret, { ok: false, reason: 'no_secret' });

  assert.equal(constantTimeEqual('abcd', 'abcd'), true);
  assert.equal(constantTimeEqual('abcd', 'abce'), false);
  assert.equal(constantTimeEqual('abcd', 'abc'), false);
  assert.deepEqual(parseStripeSignatureHeader(` t=${now} , v1=${good.toUpperCase()} `), {
    timestamp: now,
    signatures: [good],
  });
}

function testSubscriptionMapping(): void {
  // Older API shape: period end on the subscription itself.
  const older = subscriptionRowFromStripe({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    current_period_end: 1_800_000_000,
    metadata: { supabase_user_id: USER.toUpperCase() },
    items: { data: [{ price: { id: 'price_month', recurring: { interval: 'month' } } }] },
  });
  assert.deepEqual(older, {
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    status: 'active',
    price_id: 'price_month',
    billing_interval: 'month',
    current_period_end: new Date(1_800_000_000 * 1000).toISOString(),
    cancel_at_period_end: false,
    metadata_user_id: USER,
  });

  // Newer API shape: period end on the item; customer expanded to an object.
  const newer = subscriptionRowFromStripe({
    id: 'sub_2',
    customer: { id: 'cus_2' },
    status: 'canceled',
    cancel_at_period_end: true,
    metadata: {},
    items: {
      data: [{ current_period_end: 1_800_100_000, price: { id: 'price_year', recurring: { interval: 'year' } } }],
    },
  });
  assert.equal(newer?.current_period_end, new Date(1_800_100_000 * 1000).toISOString());
  assert.equal(newer?.billing_interval, 'year');
  assert.equal(newer?.cancel_at_period_end, true);
  assert.equal(newer?.metadata_user_id, null);

  // A user id that is not a UUID is never trusted.
  const badUser = subscriptionRowFromStripe({
    id: 'sub_3',
    customer: 'cus_3',
    status: 'active',
    metadata: { supabase_user_id: "1' or '1'='1" },
  });
  assert.equal(badUser?.metadata_user_id, null);
  assert.equal(badUser?.price_id, null);

  for (const broken of [null, 'sub_1', {}, { id: 'sub_1' }, { id: 'sub_1', customer: 'cus_1' }]) {
    assert.equal(subscriptionRowFromStripe(broken), null);
  }

  assert.equal(stripeId('cus_1'), 'cus_1');
  assert.equal(stripeId({ id: 'cus_1' }), 'cus_1');
  assert.equal(stripeId(null), null);
  assert.equal(asUuid(USER), USER);
  assert.equal(asUuid('nope'), null);
}

function testStatusRules(): void {
  assert.deepEqual([...PLUS_ACTIVE_STATUSES], ['active', 'trialing', 'past_due']);
  for (const status of ['active', 'trialing', 'past_due']) assert.equal(isPlusActiveStatus(status), true);
  for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', '', null]) {
    assert.equal(isPlusActiveStatus(status), false, String(status));
  }

  // The SQL that derives the plan must use the same list.
  const migration = fs.readFileSync(
    path.join(mobileRoot, 'supabase/migrations/20261009020000_billing_subscriptions.sql'),
    'utf8',
  );
  assert.match(migration, /b\.status in \('active', 'trialing', 'past_due'\)/);

  assert.equal(isHandledEventType('checkout.session.completed'), true);
  assert.equal(isHandledEventType('customer.subscription.deleted'), true);
  assert.equal(isHandledEventType('invoice.paid'), false);

  // First event for a customer, or any event for the stored subscription: apply.
  assert.equal(shouldApplySubscriptionUpdate(null, { stripe_subscription_id: 'sub_1', status: 'active' }), true);
  assert.equal(
    shouldApplySubscriptionUpdate(
      { stripe_subscription_id: 'sub_1', status: 'active' },
      { stripe_subscription_id: 'sub_1', status: 'canceled' },
    ),
    true,
  );
  // Late "ended" event for an old subscription must not switch off a live new one.
  assert.equal(
    shouldApplySubscriptionUpdate(
      { stripe_subscription_id: 'sub_new', status: 'active' },
      { stripe_subscription_id: 'sub_old', status: 'canceled' },
    ),
    false,
  );
  // Re-subscribing after a cancellation replaces the ended row.
  assert.equal(
    shouldApplySubscriptionUpdate(
      { stripe_subscription_id: 'sub_old', status: 'canceled' },
      { stripe_subscription_id: 'sub_new', status: 'active' },
    ),
    true,
  );
}

function testConsent(): void {
  const nowIso = '2026-10-09T00:00:00.000Z';
  const consent = consentRowFromCheckoutSession(
    {
      id: 'cs_1',
      mode: 'subscription',
      client_reference_id: USER,
      customer: 'cus_1',
      subscription: { id: 'sub_1' },
      amount_total: 499,
      currency: 'usd',
      created: 1_800_000_000,
      metadata: {
        price_id: 'price_month',
        billing_interval: 'month',
        terms_version: '2026-10-09',
        disclosure_version: 'v1',
      },
    },
    nowIso,
  );
  assert.deepEqual(consent, {
    user_id: USER,
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    stripe_checkout_session_id: 'cs_1',
    price_id: 'price_month',
    billing_interval: 'month',
    amount_cents: 499,
    currency: 'usd',
    terms_version: '2026-10-09',
    disclosure_version: 'v1',
    consented_at: new Date(1_800_000_000 * 1000).toISOString(),
  });

  // One-off payments are not subscription consent.
  assert.equal(consentRowFromCheckoutSession({ id: 'cs_2', mode: 'payment' }, nowIso), null);
  // Missing timestamp falls back to "now"; missing user stays null rather than guessed.
  const sparse = consentRowFromCheckoutSession({ id: 'cs_3', mode: 'subscription' }, nowIso);
  assert.equal(sparse?.consented_at, nowIso);
  assert.equal(sparse?.user_id, null);
}

function testSourceRules(): void {
  const index = fs.readFileSync(
    path.join(mobileRoot, 'supabase/functions/stripe-webhook/index.ts'),
    'utf8',
  );
  // Signature is verified on the raw body before the event is parsed.
  assert.ok(
    index.indexOf('verifyStripeSignature({') < index.indexOf('JSON.parse(rawBody)'),
    'signature must be checked before parsing',
  );
  // The webhook must never set the plan directly; only recompute_user_plan may.
  assert.doesNotMatch(index, /from\('profiles'\)/, 'webhook must not write profiles');
  assert.match(index, /rpc\('recompute_user_plan'/);
  // Only supabase-js may be imported remotely (bundler rule); no Stripe SDK.
  const remote = index.match(/from\s+['"]https?:\/\/[^'"]+['"]/g) ?? [];
  assert.ok(remote.every((stmt) => /esm\.sh\/@supabase\/supabase-js/.test(stmt)), remote.join(', '));
}

(async () => {
  await testSignature();
  testSubscriptionMapping();
  testStatusRules();
  testConsent();
  testSourceRules();
  console.log('stripe-webhook-check: ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
