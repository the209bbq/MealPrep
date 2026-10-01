import type { ThemeTokens } from '../types/mealprep';
import themeColors from './theme.colors.json';

/** Single source of truth for app colors (also used by Tailwind and PWA asset scripts). */
export const THEME: ThemeTokens = {
  brandCream: themeColors.brandCream,
  paper: themeColors.paper,
  sand: themeColors.sand,
  ink: themeColors.ink,
  muted: themeColors.muted,
  border: themeColors.border,
  card: themeColors.card,
  primary: themeColors.primary,
  primaryDark: themeColors.primaryDark,
  primaryLight: themeColors.primaryLight,
  primaryAccent: themeColors.primaryAccent,
  onPrimary: themeColors.onPrimary,
  onPrimaryMuted: themeColors.onPrimaryMuted,
  slateMuted: themeColors.slateMuted,
  success: themeColors.success,
  successDark: themeColors.successDark,
  successLight: themeColors.successLight,
  successAccent: themeColors.successAccent,
  onSuccess: themeColors.onSuccess,
  danger: themeColors.danger,
};

/** Tailwind / NativeWind color map (legacy `emerald` class names = primary navy). */
export function tailwindThemeColors(): Record<string, string> {
  const c = themeColors;
  return {
    cream: c.brandCream,
    paper: c.paper,
    sand: c.sand,
    ink: c.ink,
    muted: c.muted,
    border: c.border,
    card: c.card,
    primary: c.primary,
    'primary-dark': c.primaryDark,
    'primary-light': c.primaryLight,
    'primary-accent': c.primaryAccent,
    'on-primary': c.onPrimary,
    'on-primary-muted': c.onPrimaryMuted,
    slate: c.primaryDark,
    'slate-muted': c.slateMuted,
    emerald: c.primary,
    'emerald-dark': c.primaryDark,
    'emerald-light': c.primaryLight,
    'emerald-accent': c.primaryAccent,
    'on-emerald': c.onPrimary,
    success: c.success,
    'success-dark': c.successDark,
    'success-light': c.successLight,
    'success-accent': c.successAccent,
    'on-success': c.onSuccess,
    danger: c.danger,
  };
}
