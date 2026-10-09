import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkoutReturnUrls,
  consentCheckboxText,
  DISCLOSURE_VERSION,
  encodeStripeForm,
  formatPrice,
  isLiveSubscriptionStatus,
  normalizeAppUrl,
  parseBillingInterval,
  PRICE_LOOKUP_KEYS,
  renewalDisclosure,
  TERMS_VERSION,
} from '../supabase/functions/_shared/billingText.ts';
import { PLUS_ACTIVE_STATUSES } from '../supabase/functions/stripe-webhook/subscriptionState.ts';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8');

// Prices print the way a customer expects.
assert.equal(formatPrice(699, 'usd'), '$6.99');
assert.equal(formatPrice(6000, 'usd'), '$60');
assert.equal(formatPrice(499, 'USD'), '$4.99');
assert.equal(formatPrice(550, 'cad'), '5.50 CAD');

// Renewal wording carries the three things the law asks for: price, period, how to cancel.
const monthly = renewalDisclosure(699, 'usd', 'month');
assert.equal(
  monthly,
  'MealPlanatic Plus is $6.99 a month. It renews automatically every month until you cancel. ' +
    'Cancel any time in Account, Manage subscription.',
);
const yearly = renewalDisclosure(6000, 'usd', 'year');
assert.match(yearly, /\$60 a year/);
assert.match(yearly, /renews automatically every year until you cancel/);
assert.match(yearly, /Cancel any time in Account, Manage subscription/);
for (const text of [monthly, yearly]) {
  assert.ok(text.length <= 1200, 'Stripe custom text limit');
  assert.doesNotMatch(text, /free|trial|hurry|only \d+ left|limited time/i, 'no pressure or "free" wording');
}

const box = consentCheckboxText(6000, 'usd', 'year', 'https://mealplanatic.app/terms.html');
assert.match(box, /^I agree that MealPlanatic Plus renews automatically at \$60 every year until I cancel/);
assert.match(box, /\[Terms of Use\]\(https:\/\/mealplanatic\.app\/terms\.html\)/);

assert.equal(parseBillingInterval('month'), 'month');
assert.equal(parseBillingInterval('year'), 'year');
for (const bad of ['week', 'MONTH', '', null, undefined, 12, { interval: 'month' }]) {
  assert.equal(parseBillingInterval(bad), null);
}
assert.deepEqual(PRICE_LOOKUP_KEYS, { month: 'plus_monthly', year: 'plus_yearly' });
assert.match(DISCLOSURE_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);

// Return URLs: https only, fixed shape, no route needed on GitHub Pages.
assert.equal(normalizeAppUrl('https://mealplanatic.app'), 'https://mealplanatic.app/');
assert.equal(normalizeAppUrl(' https://mealplanatic.app/?x=1#y '), 'https://mealplanatic.app/');
assert.equal(normalizeAppUrl('http://localhost:8081'), 'http://localhost:8081/');
for (const bad of ['http://mealplanatic.app', 'javascript:alert(1)', 'mealplanatic.app', '', null, undefined]) {
  assert.equal(normalizeAppUrl(bad), null, String(bad));
}
assert.deepEqual(checkoutReturnUrls('https://mealplanatic.app/'), {
  success: 'https://mealplanatic.app/?checkout=success',
  cancel: 'https://mealplanatic.app/?checkout=cancel',
  portal: 'https://mealplanatic.app/?billing=return',
  terms: 'https://mealplanatic.app/terms.html',
});

// Stripe form encoding: nested objects and arrays use bracket keys; empty values are dropped.
const encoded = new URLSearchParams(
  encodeStripeForm({
    mode: 'subscription',
    line_items: [{ price: 'price_1', quantity: 1 }],
    consent_collection: { terms_of_service: 'required' },
    metadata: { supabase_user_id: 'u1', note: 'a&b=c' },
    lookup_keys: ['plus_monthly'],
    active: true,
    configuration: null,
    skipped: undefined,
  }),
);
assert.equal(encoded.get('mode'), 'subscription');
assert.equal(encoded.get('line_items[0][price]'), 'price_1');
assert.equal(encoded.get('line_items[0][quantity]'), '1');
assert.equal(encoded.get('consent_collection[terms_of_service]'), 'required');
assert.equal(encoded.get('metadata[note]'), 'a&b=c');
assert.equal(encoded.get('lookup_keys[0]'), 'plus_monthly');
assert.equal(encoded.get('active'), 'true');
assert.equal(encoded.has('configuration'), false);
assert.equal(encoded.has('skipped'), false);

// "Already subscribed" uses the same status list as the webhook and the SQL.
for (const status of PLUS_ACTIVE_STATUSES) assert.equal(isLiveSubscriptionStatus(status), true);
for (const status of ['canceled', 'unpaid', 'incomplete', null, undefined]) {
  assert.equal(isLiveSubscriptionStatus(status), false);
}

// Source rules for the two functions that start payments.
const checkout = read('supabase/functions/stripe-checkout/index.ts');
const portal = read('supabase/functions/stripe-portal/index.ts');
const server = read('supabase/functions/_shared/billingServer.ts');

// Sign-in is verified with Supabase Auth, never by decoding the token.
assert.match(server, /auth\.getUser\(\)/);
for (const source of [checkout, portal, server]) {
  assert.doesNotMatch(source, /atob\(|split\('\.'\)/, 'never decode the sign-in token by hand');
}
// Price ids, customer ids and return URLs never come from the request body.
assert.doesNotMatch(checkout, /body\.(price|priceId|price_id|success_url|cancel_url|customer)/);
assert.doesNotMatch(portal, /req\.json\(\)/, 'portal takes nothing from the request body');
assert.match(checkout, /lookup_keys: \[PRICE_LOOKUP_KEYS\[interval\]\]/);
// The consent box is required and the disclosure sits by the pay button.
assert.match(checkout, /consent_collection: \{ terms_of_service: 'required' \}/);
assert.match(checkout, /submit: \{ message: renewalDisclosure\(/);
assert.match(checkout, /disclosure_version: DISCLOSURE_VERSION/);
assert.match(checkout, /terms_version: TERMS_VERSION/);
// A second purchase is refused, and the user id travels to the webhook two ways.
assert.match(checkout, /ALREADY_SUBSCRIBED/);
assert.match(checkout, /client_reference_id: userId/);
assert.match(checkout, /subscription_data: \{[\s\S]*supabase_user_id: userId/);
// Neither function may change the plan; only the webhook's recompute does.
for (const source of [checkout, portal]) {
  assert.doesNotMatch(source, /from\('profiles'\)|recompute_user_plan|plan_comp/);
}
// Only supabase-js is imported remotely (bundler rule); no Stripe SDK.
for (const source of [checkout, portal, server]) {
  const remote = source.match(/from\s+['"]https?:\/\/[^'"]+['"]/g) ?? [];
  assert.ok(remote.every((stmt) => /esm\.sh\/@supabase\/supabase-js/.test(stmt)), remote.join(', '));
}

// The terms version we record must be the date printed on the live terms page.
const termsHtml = read('public/terms.html');
const [year, month, day] = TERMS_VERSION.split('-').map(Number);
const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
assert.ok(
  termsHtml.includes(`${monthName} ${day}, ${year}`),
  `terms.html should be dated ${monthName} ${day}, ${year} to match TERMS_VERSION`,
);

console.log('stripe-checkout-check: ok');
