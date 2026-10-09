import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';

export function RecipesTabCollapsibleSection({
  title,
  expanded,
  onToggle,
  bubbleRow,
  children,
  loading,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  /** Horizontally scrollable chips/avatars; always visible above expandable body. */
  bubbleRow?: React.ReactNode;
  children?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <View className="mt-4">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${expanded ? 'collapse' : 'expand'}`}
        className="min-h-[44px] flex-row items-center justify-between py-1"
      >
        <Text accessibilityRole="header" className="text-lg font-extrabold text-ink">
          {title}
        </Text>
        <View className="flex-row items-center gap-2">
          {loading ? (
            <Text className="text-xs text-muted">Loading…</Text>
          ) : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.muted} />
        </View>
      </Pressable>
      {bubbleRow ? <View className="mt-1">{bubbleRow}</View> : null}
      {expanded && children ? <View className="mt-2">{children}</View> : null}
    </View>
  );
}
