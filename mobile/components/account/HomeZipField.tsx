import { Text, TextInput, View } from 'react-native';
import { ACCOUNT_SHEET_COPY } from '../../config/account';
import { THEME } from '../../config/appConfig';
import {
  formatHomeZipInput,
  PROFILE_HOME_ZIP_COPY,
} from '../../lib/profile/homeZip';
import { localZipPlaceLabel } from '../../lib/stores/localZipTable';

type HomeZipFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  hint?: string | null;
  error?: string | null;
};

export function HomeZipField({ value, onChange, className = 'mt-4', hint, error }: HomeZipFieldProps) {
  const zipLabel = localZipPlaceLabel(value);

  return (
    <View className={className}>
      <Text className="text-sm font-semibold text-ink">{ACCOUNT_SHEET_COPY.homeZipLabel}</Text>
      <Text className="mt-0.5 text-xs text-muted">
        {hint ?? ACCOUNT_SHEET_COPY.homeZipBlurb}
      </Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(formatHomeZipInput(text))}
        keyboardType="number-pad"
        maxLength={5}
        className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-ink"
        placeholder="12345"
        placeholderTextColor={THEME.muted}
        accessibilityLabel={PROFILE_HOME_ZIP_COPY.accessibilityLabel}
      />
      {zipLabel ? <Text className="mt-1 text-xs text-muted">{zipLabel}</Text> : null}
      {error ? <Text className="mt-1 text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
