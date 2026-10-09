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
    const mark = Math.max(headerMarkSize + 6, 36);
    return (
      <View
        className="shrink flex-row items-center gap-2.5"
        accessibilityRole="header"
        accessibilityLabel={APP_BRAND.name}
      >
        <View className="overflow-hidden rounded-full" style={{ backgroundColor: cream, width: mark, height: mark }}>
          <Image source={APP_BRAND_IMAGES.logoMark} style={[{ width: mark, height: mark }, style]} resizeMode="cover" />
        </View>
        {/* Wordmark as in the approved logo: "Plan" picked out in light tomato on green. */}
        <Text className="shrink text-[19px] font-extrabold text-cream" style={{ letterSpacing: -0.3 }} numberOfLines={1}>
          Meal<Text style={{ color: '#F8A27F' }}>Plan</Text>atic
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
