import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { OPEN_FOOD_FACTS, OPEN_FOOD_FACTS_COPY } from '../../config/openFoodFacts';
import { lookupOpenFoodFactsProduct, suggestedPantryName } from '../../lib/openFoodFacts/client';
import type { OpenFoodFactsLookupResult, OpenFoodFactsProduct } from '../../lib/openFoodFacts/types';
import { OpenFoodFactsCreditLine } from './OpenFoodFactsCreditLine';

type Props = {
  /** Called with the found product so the form can prefill the item name. */
  onProductFound: (product: OpenFoodFactsProduct) => void;
};

function messageFor(result: OpenFoodFactsLookupResult): string | null {
  switch (result.status) {
    case 'invalid_barcode':
      return OPEN_FOOD_FACTS_COPY.invalidBarcode;
    case 'not_found':
      return OPEN_FOOD_FACTS_COPY.notFound;
    case 'rate_limited':
      return OPEN_FOOD_FACTS_COPY.rateLimited;
    case 'error':
      return OPEN_FOOD_FACTS_COPY.error;
    default:
      return null;
  }
}

export function PantryBarcodeLookup({ onProductFound }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OpenFoodFactsLookupResult | null>(null);
  const busyRef = useRef(false);

  async function lookUp() {
    if (busyRef.current || !code.trim()) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // Browsers forbid setting User-Agent, so only native identifies itself to Open Food Facts.
      const next = await lookupOpenFoodFactsProduct(code, {
        userAgent: Platform.OS === 'web' ? null : OPEN_FOOD_FACTS.userAgent,
      });
      setResult(next);
      if (next.status === 'found') onProductFound(next.product);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const found = result?.status === 'found' ? result.product : null;
  const message = result ? messageFor(result) : null;

  return (
    <View className="mt-4">
      <Text className="text-xs font-bold uppercase tracking-wide text-muted">{OPEN_FOOD_FACTS_COPY.sectionLabel}</Text>
      <View className="mt-2 flex-row gap-2">
        <TextInput
          value={code}
          onChangeText={(text) => {
            setCode(text);
            if (result) setResult(null);
          }}
          onSubmitEditing={() => void lookUp()}
          keyboardType="number-pad"
          returnKeyType="search"
          placeholder={OPEN_FOOD_FACTS_COPY.inputPlaceholder}
          placeholderTextColor={THEME.muted}
          accessibilityLabel={OPEN_FOOD_FACTS_COPY.sectionLabel}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
        />
        <Pressable
          onPress={() => void lookUp()}
          disabled={busy || !code.trim()}
          accessibilityRole="button"
          accessibilityLabel={OPEN_FOOD_FACTS_COPY.lookupButton}
          className={`items-center justify-center rounded-xl bg-primary px-4 ${busy || !code.trim() ? 'opacity-50' : ''}`}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-sm font-bold text-on-primary">{OPEN_FOOD_FACTS_COPY.lookupButton}</Text>
          )}
        </Pressable>
      </View>

      {message ? <Text className="mt-2 text-sm text-muted">{message}</Text> : null}

      {found ? (
        <View className="mt-2">
          <Text className="text-sm font-semibold text-ink">
            {OPEN_FOOD_FACTS_COPY.foundPrefix} {suggestedPantryName(found)}
            {found.packageSize ? ` (${found.packageSize})` : ''}
          </Text>
          {found.allergens.length > 0 ? (
            <Text className="mt-1 text-xs text-muted">
              {OPEN_FOOD_FACTS_COPY.allergensPrefix} {found.allergens.join(', ')}. {OPEN_FOOD_FACTS_COPY.allergensNote}
            </Text>
          ) : null}
        </View>
      ) : null}

      {found ? <OpenFoodFactsCreditLine pageUrl={found.pageUrl} /> : null}
    </View>
  );
}
