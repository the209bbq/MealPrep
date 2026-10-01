import { Image, type ImageStyle, type StyleProp, View } from 'react-native';
import { APP_BRAND, APP_BRAND_IMAGES } from '../config/appBrand';

type BrandLogoVariant = 'header' | 'auth';

type BrandLogoProps = {
  variant: BrandLogoVariant;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ variant, style }: BrandLogoProps) {
  const source = APP_BRAND_IMAGES.logoFullTransparent;
  const { headerLogoHeight, authLogoWidth } = APP_BRAND.ui;

  if (variant === 'header') {
    return (
      <View className="justify-center" accessibilityRole="image" accessibilityLabel={APP_BRAND.name}>
        <Image
          source={source}
          style={[{ height: headerLogoHeight, width: headerLogoHeight * 3.2 }, style]}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View className="items-center py-2" accessibilityRole="image" accessibilityLabel={APP_BRAND.name}>
      <Image
        source={source}
        style={[{ width: authLogoWidth, height: authLogoWidth * 0.38 }, style]}
        resizeMode="contain"
      />
    </View>
  );
}
