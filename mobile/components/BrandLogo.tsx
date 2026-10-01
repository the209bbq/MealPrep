import { Image, Text, type ImageStyle, type StyleProp, View } from 'react-native';
import { APP_BRAND, APP_BRAND_IMAGES } from '../config/appBrand';

type BrandLogoVariant = 'header' | 'auth';

type BrandLogoProps = {
  variant: BrandLogoVariant;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ variant, style }: BrandLogoProps) {
  const { headerMarkSize, authLogoWidth } = APP_BRAND.ui;
  const cream = APP_BRAND.colors.brandCream;

  if (variant === 'header') {
    return (
      <View
        className="max-w-[58%] shrink flex-row items-center gap-1.5"
        accessibilityRole="header"
        accessibilityLabel={APP_BRAND.name}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{ backgroundColor: cream, width: headerMarkSize + 6, height: headerMarkSize + 6 }}
        >
          <Image
            source={APP_BRAND_IMAGES.logoMark}
            style={[{ width: headerMarkSize, height: headerMarkSize }, style]}
            resizeMode="contain"
          />
        </View>
        <Text className="shrink text-sm font-bold text-on-primary" numberOfLines={1}>
          {APP_BRAND.shortName}
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center py-2" accessibilityRole="image" accessibilityLabel={APP_BRAND.name}>
      <Image
        source={APP_BRAND_IMAGES.logoFullTransparent}
        style={[{ width: authLogoWidth, height: authLogoWidth * 0.38 }, style]}
        resizeMode="contain"
      />
    </View>
  );
}
