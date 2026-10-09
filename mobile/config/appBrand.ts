import type { ImageSourcePropType } from 'react-native';
import brandJson from './appBrand.json';

export type AppBrandColors = {
  brandCream: string;
  themePrimaryDark: string;
  iconBackground: string;
  /** Colour of the accent word in the wordmark when it sits on the green header. */
  wordmarkAccentOnDark: string;
};

/** Mascot placement on the square app icon, as fractions of the icon size. */
export type AppBrandMascotPlacement = {
  left: number;
  top: number;
  width: number;
};

export type AppBrandAssetPaths = {
  icon: string;
  iconMaskable: string;
  splashIcon: string;
  favicon: string;
  androidIconForeground: string;
  androidIconBackground: string;
  androidIconMonochrome: string;
  logoFull: string;
  logoFullTransparent: string;
  logoMark: string;
};

export type AppBrandUi = {
  headerMarkSize: number;
  authLogoWidth: number;
};

export type AppBrandCopy = {
  authCardSubtitle: string;
  authCardBlurb: string;
};

export type AppBrandConfig = {
  name: string;
  shortName: string;
  /** Part of the name shown in the accent colour, as in the logo. */
  wordmarkAccent: string;
  pwaDescription: string;
  colors: AppBrandColors;
  sourceMascot: string;
  sourceLogo: string;
  iconMascot: AppBrandMascotPlacement;
  assets: AppBrandAssetPaths;
  ui: AppBrandUi;
  copy: AppBrandCopy;
};

/** Brand metadata and relative asset paths (see `generate-brand-assets.mjs`). */
export const APP_BRAND: AppBrandConfig = brandJson;

/** Bundled images for in-app `<Image />` usage. */
export const APP_BRAND_IMAGES = {
  logoFull: require('../assets/mealplanatic-logo-full.png') as ImageSourcePropType,
  logoFullTransparent: require('../assets/mealplanatic-logo-full-transparent.png') as ImageSourcePropType,
  logoMark: require('../assets/mealplanatic-logo-mark.png') as ImageSourcePropType,
} as const;
