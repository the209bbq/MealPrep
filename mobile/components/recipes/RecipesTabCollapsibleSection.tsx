import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';

export function RecipesTabCollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
  loading,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <View className="mt-4">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${expanded ? 'collapse' : 'expand'}`}
        className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-border bg-card px-3 py-2"
      >
        <Text accessibilityRole="header" className="text-sm font-bold text-ink">
          {title}
        </Text>
        <View className="flex-row items-center gap-2">
          {loading ? (
            <Text className="text-xs text-muted">Loading…</Text>
          ) : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.muted} />
        </View>
      </Pressable>
      {expanded ? <View className="mt-2">{children}</View> : null}
    </View>
  );
}
