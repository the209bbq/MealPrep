# Taking real payments: go-live checklist

Written Oct 9, 2026 by the manager session. Nothing here has been done yet. Work top to bottom;
do not skip a gate. Never paste a Stripe or Supabase key into chat, an issue or a pull request.

Until step 5, the app is in Stripe **test mode** and cannot charge a real card.

## 1. Gates (all must be true before anything below)

- [ ] Compliance has closed handoff 1 (subscription wording, consent record, cancel path, terms section).
- [ ] The terms and privacy pages on the live site name who operates MealPlanatic, the governing law, the Plus price, renewal, cancellation and the scan limits (PR #214).
- [ ] `stripe-webhook`, `stripe-checkout`, `stripe-portal` and `delete-user-account` on Supabase match `main` (deploy each from Actions -> Deploy Supabase function after the last billing PR merges).
- [ ] Testing has retested T-4, T-5 and T-6 and the checks still open in "What is still untested" in the testing doc: cancel in Manage subscription, declined card, deleting an account with a subscription.
- [ ] A monthly scan cap is live (PR #219 and its migration), so a paying account cannot cost more than it pays.

## 2. Stripe dashboard, live mode (owner)

Switch the dashboard out of the sandbox first. Then:

- [ ] Product "MealPlanatic Plus" with two recurring prices: **$6.99 monthly** with lookup key `plus_monthly`, and **$60 yearly** with lookup key `plus_yearly`. The code finds prices by lookup key, so the keys must match exactly.
- [ ] Customer portal: cancellation allowed, cancel **at period end**, no survey or offer before the cancel button, card update and invoice history on, plan switching off. Set as default.
- [ ] Public business details: Terms of Service URL `https://mealplanatic.app/terms.html`, privacy URL, support email. The required consent box at checkout cannot show without the terms URL.
- [ ] Emails: successful-payment receipts on; **renewal reminder for yearly subscriptions on** (the terms promise it); failed-payment emails on.
- [ ] Payment methods: decide which stay on. The sandbox offered card, Link, Klarna, Cash App Pay and Amazon Pay; fees and dispute rules differ and the margin figures assume cards.
- [ ] Adaptive pricing: off, or the buy button's "$6.99" can disagree with a local-currency price abroad.
- [ ] Webhook endpoint `https://okkwapgyadpaifpmkcex.supabase.co/functions/v1/stripe-webhook` with exactly these six events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copy its signing secret straight into Supabase (step 4).
- [ ] The earlier endpoint `we_1UOUIi...` that Stripe's API reports as live mode: delete it, or confirm it is the one just created. There must be exactly one live endpoint for this URL, or every event is handled twice.

## 3. Clear test data from the live database (manager prepares, owner approves)

Test-mode customers, subscriptions and consents are stored in the live tables. After the key
switch they would give test subscribers Plus for nothing and (for a non-live row) confuse
checkout. They hold test data only.

Read first, then delete, in one transaction, after the owner says go:

```sql
-- Look before deleting. Expect only test-mode rows (customer ids created during testing).
select user_id, stripe_customer_id, stripe_subscription_id, status from public.billing_subscriptions;
select count(*) from public.billing_consents;
select count(*) from public.stripe_events;

begin;
  -- Remember who had a linked row, to re-derive their plan afterwards.
  create temporary table _affected on commit drop as
    select distinct user_id from public.billing_subscriptions where user_id is not null;
  delete from public.stripe_events;
  delete from public.billing_consents;
  delete from public.billing_subscriptions;
  -- Plans come only from recompute_user_plan: comped accounts stay Plus, test buyers return to free.
  select public.recompute_user_plan(user_id) from _affected;
commit;

select plan, plan_comp, count(*) from public.profiles group by 1, 2;
```

- [ ] Counts noted before and after. No profile with `plan_comp = true` changed.
- [ ] Do this **after** the last test purchase and **before** step 4. Do not run it once real customers exist.

## 4. Switch the keys (owner, in Supabase -> Edge Functions -> Secrets)

- [ ] `STRIPE_SECRET_KEY`: the live secret key (a restricted key is better: Customers, Checkout Sessions, Subscriptions, Prices and Billing Portal, read and write).
- [ ] `STRIPE_WEBHOOK_SECRET`: the signing secret of the live endpoint from step 2. This also retires the test secret that was shown once in chat.
- [ ] `APP_WEB_URL` stays `https://mealplanatic.app/`.
- [ ] No redeploy is needed; functions read secrets on each request.

## 5. First real purchase (owner, then manager checks read-only)

Use a free, non-admin account and a real card.

- [ ] Account -> Plan shows both prices and the renewal wording; the Stripe page shows the same wording and an unticked box.
- [ ] Pay for **monthly** ($6.99). The app shows Plus within about 20 seconds without a reload.
- [ ] Manager confirms: one `billing_subscriptions` row linked to that account with status `active`; one `billing_consents` row with the price, terms version and disclosure version; the profile is `paid` with `plan_comp` false; the listener answered 200.
- [ ] A photo scan works on that account.
- [ ] Manage subscription -> cancel. Plus stays until the period end; the row shows cancel at period end.
- [ ] Refund the $6.99 in the Stripe dashboard.
- [ ] Press Upgrade twice quickly and from two tabs: one Checkout page only.

## 6. If something is wrong

- Put the two test-mode secrets back in Supabase. Checkout then makes test pages again and no real card can be charged.
- Refund any real charge in the Stripe dashboard. Stripe's fee on a refunded charge is not returned.
- Events Stripe could not deliver are retried for days; fix the listener and they will arrive.

## Known limits at go-live

- Sales tax is not collected (Stripe Tax is off). Ask an accountant whether software subscriptions are taxable in California and elsewhere.
- Deleting an account cancels Plus at once with no refund for the unused part of the period. The terms say so; compliance has not confirmed it.
- Receipts are not saved and prices are not read from them.
- The webhook does not yet alert if a customer somehow has two live subscriptions; the checkout guard is the only protection.
