import type { ComponentProps } from 'react';
import type IoniconsBase from '@expo/vector-icons/Ionicons';
import { HydrationSafeIonicon } from '../../components/HydrationSafeIonicon';

/** Web static export: defer icon font glyphs until after hydration. */
export const Ionicons = HydrationSafeIonicon;

export type IoniconName = ComponentProps<typeof IoniconsBase>['name'];
