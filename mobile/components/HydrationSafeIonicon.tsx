import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useHydrated } from '../hooks/useHydrated';

type HydrationSafeIoniconProps = ComponentProps<typeof Ionicons>;

/** Vector icons load web fonts after mount; defer to avoid static-export hydration mismatch. */
export function HydrationSafeIonicon({ size = 24, style, ...rest }: HydrationSafeIoniconProps) {
  const hydrated = useHydrated();
  const dimension: number = typeof size === 'number' ? size : 24;
  if (!hydrated) {
    return <View style={{ width: dimension, height: dimension } as const} />;
  }
  return <Ionicons size={size} style={style} {...rest} />;
}
