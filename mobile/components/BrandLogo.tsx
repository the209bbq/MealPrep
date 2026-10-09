import { Image, Text, type ImageStyle, type StyleProp, View } from 'react-native';
import { APP_BRAND, APP_BRAND_IMAGES } from '../config/appBrand';

type BrandLogoVariant = 'header' | 'auth';

/** Splits the name around its accent word so "Plan" can take the accent colour, as in the logo. */
function splitWordmark(name: string, accent: string): { before: string; accent: string; after: string } {
  const at = accent ? name.indexOf(accent) : -1;
  if (at < 0) return { before: name, accent: '', after: '' };
  return { before: name.slice(0, at), accent, after: name.slice(at + accent.length) };
}

type BrandLogoProps = {
  variant: BrandLogoVariant;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ variant, style }: BrandLogoProps) {
  const { headerMarkSize, authLogoWidth } = APP_BRAND.ui;
  const cream = APP_BRAND.colors.brandCream;
  const wordmark = splitWordmark(APP_BRAND.shortName, APP_BRAND.wordmarkAccent);

  if (variant === 'header') {
    return (
      <View
        className="max-w-[70%] shrink flex-row items-center gap-2"
        accessibilityRole="header"
        accessibilityLabel={APP_BRAND.name}
      >
        <View
          className="overflow-hidden rounded-full"
          style={{ backgroundColor: cream, width: headerMarkSize + 6, height: headerMarkSize + 6 }}
        >
          <Image
            source={APP_BRAND_IMAGES.logoMark}
            style={[{ width: headerMarkSize + 6, height: headerMarkSize + 6 }, style]}
            resizeMode="cover"
          />
        </View>
        <Text className="shrink text-lg font-extrabold text-on-primary" numberOfLines={1}>
          {wordmark.before}
          <Text style={{ color: APP_BRAND.colors.wordmarkAccentOnDark }}>{wordmark.accent}</Text>
          {wordmark.after}
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
