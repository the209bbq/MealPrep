import type { ComponentProps } from 'react';
import { Ionicons } from '../lib/icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { HydrationSafeIonicon } from './HydrationSafeIonicon';
import { THEME } from '../config/appConfig';
import type { HomeNextStep } from '../lib/home/nextStep';

interface NextStepCardProps {
  step: HomeNextStep;
  onPress: () => void;
}

const ICONS: Record<HomeNextStep['kind'], ComponentProps<typeof Ionicons>['name']> = {
  scan_pantry: 'camera',
  shop_list: 'pricetags',
  add_missing: 'list',
  cook_recipe: 'flame',
  build_pantry: 'leaf',
};

export function NextStepCard({ step, onPress }: NextStepCardProps) {
  return (
    <View className="mt-4 overflow-hidden rounded-3xl border-2 border-primary bg-card px-5 py-5">
      <Text className="text-xs font-bold uppercase tracking-widest text-primary-dark">Next step</Text>
      <View className="mt-3 flex-row items-start gap-3">
        <View className="rounded-2xl bg-primary-light p-3">
          <HydrationSafeIonicon name={ICONS[step.kind]} size={26} color={THEME.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-xl font-bold leading-snug text-ink">{step.title}</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">{step.body}</Text>
          <Pressable onPress={onPress} className="mt-4 min-h-[48px] items-center justify-center rounded-2xl bg-primary px-4 py-3">
            <Text className="text-base font-bold text-on-primary">{step.ctaLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
