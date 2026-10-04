import { Ionicons } from '../../lib/icons/Ionicons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { STORES_TAB_COPY } from '../../config/storesTab';
import { THEME } from '../../config/appConfig';

type Props = {
  onUseLocation: () => void;
  onEnterZip: () => void;
  locationDeniedHelp?: string | null;
  showZipField?: boolean;
  zip?: string;
  onZipChange?: (value: string) => void;
  onSaveZip?: () => void;
};

export function StoresLocationPrePrompt({
  onUseLocation,
  onEnterZip,
  locationDeniedHelp,
  showZipField,
  zip,
  onZipChange,
  onSaveZip,
}: Props) {
  return (
    <View className="mt-4 rounded-2xl border border-border bg-card px-4 py-4">
      <Text className="text-base font-semibold text-ink">{STORES_TAB_COPY.findStoresTitle}</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          onPress={onUseLocation}
          className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2"
        >
          <Ionicons name="locate" size={18} color={THEME.onPrimary} />
          <Text className="text-sm font-bold text-on-primary">{STORES_TAB_COPY.useMyLocation}</Text>
        </Pressable>
        <Pressable onPress={onEnterZip} className="min-h-[44px] justify-center rounded-xl border border-border px-4 py-2">
          <Text className="text-sm font-semibold text-ink">{STORES_TAB_COPY.enterZip}</Text>
        </Pressable>
      </View>
      {locationDeniedHelp ? <Text className="mt-3 text-xs text-muted">{locationDeniedHelp}</Text> : null}
      {showZipField && onZipChange && onSaveZip ? (
        <View className="mt-3 flex-row gap-2">
          <TextInput
            value={zip}
            onChangeText={onZipChange}
            keyboardType="number-pad"
            placeholder={STORES_TAB_COPY.zipShort}
            placeholderTextColor={THEME.muted}
            maxLength={10}
            className="flex-1 rounded-xl border border-border bg-paper px-4 py-3 text-base text-ink"
          />
          <Pressable onPress={onSaveZip} className="justify-center rounded-xl bg-slate px-4 py-3">
            <Text className="font-bold text-on-primary">Go</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
