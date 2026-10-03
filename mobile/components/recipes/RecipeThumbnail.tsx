import { Image } from 'expo-image';
import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { THEME } from '../../config/appConfig';

export interface RecipeThumbnailProps {
  uri: string | null | undefined;
  accessibilityLabel: string;
  height?: number;
  aspectRatio?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** When true, defer decoding until near viewport (FlatList / ScrollView lists). */
  lazy?: boolean;
}

export function RecipeThumbnail({
  uri,
  accessibilityLabel,
  height,
  aspectRatio = RECIPE_IMAGE.aspectRatio,
  className = '',
  style,
  lazy = false,
}: RecipeThumbnailProps) {
  const safeUri = useMemo(() => (uri?.trim() ? uri.trim() : null), [uri]);
  const showImage = Boolean(safeUri);

  return (
    <View
      className={`overflow-hidden bg-card ${className}`}
      style={[{ width: '100%' }, height != null ? { height } : { aspectRatio }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {showImage ? (
        <Image
          source={{ uri: safeUri! }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={safeUri!}
          transition={RECIPE_IMAGE.transitionMs}
          priority={lazy ? 'low' : 'normal'}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-primary-light">
          <Ionicons name="restaurant-outline" size={32} color={THEME.primary} accessibilityElementsHidden />
        </View>
      )}
    </View>
  );
}
