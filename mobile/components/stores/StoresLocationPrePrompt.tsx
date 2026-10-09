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
    <View className="mt-3.5 rounded-[20px] border border-border bg-card px-4 py-4">
      <Text className="text-[17px] font-extrabold text-ink">{STORES_TAB_COPY.findStoresTitle}</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          onPress={onUseLocation}
          className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 active:opacity-80"
        >
          <Ionicons name="locate" size={18} color={THEME.onPrimary} />
          <Text className="text-sm font-bold text-on-primary">{STORES_TAB_COPY.useMyLocation}</Text>
        </Pressable>
        <Pressable
          onPress={onEnterZip}
          className="min-h-[44px] justify-center rounded-full border border-primary bg-card px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm font-bold text-primary">{STORES_TAB_COPY.enterZip}</Text>
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
            className="h-12 min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-0 text-base text-ink"
          />
          <Pressable
            onPress={onSaveZip}
            className="min-h-[48px] min-w-[56px] items-center justify-center rounded-full bg-primary px-4 active:opacity-80"
          >
            <Text className="font-bold text-on-primary">Go</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
