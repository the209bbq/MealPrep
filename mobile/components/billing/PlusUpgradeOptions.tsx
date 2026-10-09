import { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { LEGAL_LINKS } from '../../config/account';
import { PLUS_INTERVAL_ORDER, PLUS_UPGRADE_COPY, type BillingInterval } from '../../config/pricing';
import { useApp } from '../../context/AppContext';
import { BillingError, startPlusCheckout } from '../../lib/billing/client';
import { plusPriceLabel, plusRenewalDisclosure, plusSubscribeLabel } from '../../lib/billing/pricing';

type Props = {
  /** Shows a "Not now" button that calls this. */
  onNotNow?: () => void;
};

/** Plus is sold on the web only; store builds must not link out to another payment system. */
export function canBuyPlusHere(): boolean {
  return Platform.OS === 'web';
}

/**
 * Plan choice, renewal terms and the buy button.
 * Rules (California automatic renewal law, compliance handoff 1): the price, renewal period and
 * how to cancel sit directly above the button in normal-size text; nothing is pre-ticked beyond
 * the plan choice itself; no countdowns or pressure wording; the button states the price.
 */
export function PlusUpgradeOptions({ onNotNow }: Props) {
  const { isGuest, demoMode, openAuthSheet } = useApp();
  const [interval, setChosenInterval] = useState<BillingInterval>(PLUS_INTERVAL_ORDER[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canBuyPlusHere() || demoMode) return null;

  if (isGuest) {
    return (
      <View className="mt-3">
        <Text className="text-sm leading-5 text-muted">{PLUS_UPGRADE_COPY.signInHint}</Text>
        <Pressable
          onPress={openAuthSheet}
          accessibilityRole="button"
          className="mt-3 min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-3"
        >
          <Text className="text-center font-bold text-on-primary">{PLUS_UPGRADE_COPY.signInToUpgrade}</Text>
        </Pressable>
        {onNotNow ? <NotNowButton onPress={onNotNow} /> : null}
      </View>
    );
  }

  async function subscribe() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await startPlusCheckout(interval);
      // On success the browser leaves for Stripe; keep the button disabled meanwhile.
    } catch (err) {
      setError(err instanceof BillingError ? err.message : PLUS_UPGRADE_COPY.genericError);
      setBusy(false);
    }
  }

  return (
    <View className="mt-3">
      <View accessibilityRole="radiogroup" className="gap-2">
        {PLUS_INTERVAL_ORDER.map((option) => {
          const selected = option === interval;
          return (
            <Pressable
              key={option}
              onPress={() => setChosenInterval(option)}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: busy }}
              accessibilityLabel={plusPriceLabel(option)}
              className={`min-h-[44px] flex-row items-center rounded-xl border px-3 py-3 ${
                selected ? 'border-primary bg-primary-light' : 'border-border bg-paper'
              }`}
            >
              <View
                className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-primary' : 'border-border'
                }`}
              >
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </View>
              <Text className="text-base font-bold text-ink">{plusPriceLabel(option)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-3 text-sm leading-5 text-ink">
        {plusRenewalDisclosure(interval)}{' '}
        <Text
          accessibilityRole="link"
          onPress={() => void Linking.openURL(LEGAL_LINKS.terms)}
          className="text-sm font-semibold text-primary underline"
        >
          {PLUS_UPGRADE_COPY.termsLinkLabel}
        </Text>
      </Text>

      <Pressable
        onPress={() => void subscribe()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        className={`mt-3 min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-3 ${
          busy ? 'opacity-60' : ''
        }`}
      >
        <Text className="text-center font-bold text-on-primary">
          {busy ? PLUS_UPGRADE_COPY.starting : plusSubscribeLabel(interval)}
        </Text>
      </Pressable>

      {error ? (
        <Text accessibilityRole="alert" className="mt-2 text-sm font-semibold text-danger">
          {error}
        </Text>
      ) : null}

      {onNotNow ? <NotNowButton onPress={onNotNow} disabled={busy} /> : null}
    </View>
  );
}

function NotNowButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="mt-2 min-h-[44px] items-center justify-center rounded-xl border border-border bg-paper px-4 py-3"
    >
      <Text className="text-sm font-semibold text-muted">{PLUS_UPGRADE_COPY.notNow}</Text>
    </Pressable>
  );
}
