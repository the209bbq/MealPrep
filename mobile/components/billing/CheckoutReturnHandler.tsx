import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { CHECKOUT_RETURN_COPY } from '../../config/pricing';
import { useApp } from '../../context/AppContext';
import { parseCheckoutReturn, PLAN_UNLOCK_POLL, stripCheckoutReturn } from '../../lib/billing/checkoutReturn';

/**
 * Handles the trip back from Stripe (`?checkout=success|cancel`, `?billing=return`).
 * Plus is switched on by the server when Stripe confirms payment, never by this page, so after
 * a successful checkout we simply re-read the plan until it shows as paid.
 */
export function CheckoutReturnHandler() {
  const { session, refreshProfilePlan, showNotice } = useApp();
  const userId = session?.user.id ?? null;
  const handled = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || handled.current) return undefined;
    const outcome = parseCheckoutReturn(window.location.search);
    if (!outcome) return undefined;
    // Wait for sign-in to restore before reading the plan; a cancel needs no account.
    if (outcome !== 'cancel' && !userId) return undefined;

    handled.current = true;
    const cleaned = `${window.location.pathname}${stripCheckoutReturn(window.location.search)}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', cleaned);

    if (outcome === 'cancel') {
      showNotice(CHECKOUT_RETURN_COPY.cancelled);
      return undefined;
    }
    if (outcome === 'portal') {
      void refreshProfilePlan();
      return undefined;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const check = async () => {
      if (stopped) return;
      attempt += 1;
      const plan = await refreshProfilePlan();
      if (stopped) return;
      if (plan === 'paid') {
        showNotice(CHECKOUT_RETURN_COPY.unlocked);
        return;
      }
      if (attempt >= PLAN_UNLOCK_POLL.attempts) {
        showNotice(CHECKOUT_RETURN_COPY.pending);
        return;
      }
      timer = setTimeout(() => void check(), PLAN_UNLOCK_POLL.intervalMs);
    };
    void check();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, refreshProfilePlan, showNotice]);

  return null;
}
