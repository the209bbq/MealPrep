import { Text, View } from 'react-native';
import { ACCOUNT_UPGRADE_COPY } from '../../config/account';
import { PLAN_LABELS, type UserPlan } from '../../config/plans';

type Props = {
  plan: UserPlan;
};

export function AccountPlanSection({ plan }: Props) {
  const isPaid = plan === 'paid';
  return (
    <View className="rounded-2xl border border-border bg-card px-4 py-3">
      <Text className="text-xs font-bold uppercase text-muted">Plan</Text>
      <Text className="mt-1 text-base font-bold text-ink">{PLAN_LABELS[plan]}</Text>
      <Text className="mt-2 text-sm leading-5 text-muted">
        {isPaid ? ACCOUNT_UPGRADE_COPY.paidBlurb : ACCOUNT_UPGRADE_COPY.freeBlurb}
      </Text>
    </View>
  );
}
