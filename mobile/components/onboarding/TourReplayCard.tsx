import { Pressable, Text } from 'react-native';
import { ONBOARDING_COPY } from '../../config/onboarding';
import { Card } from '../Card';

type TourReplayCardProps = {
  onReplay: () => void;
  className?: string;
};

export function TourReplayCard({ onReplay, className = 'mt-4' }: TourReplayCardProps) {
  const { account: copy } = ONBOARDING_COPY;
  return (
    <Card className={className} title={copy.showTourAgainTitle} subtitle={copy.showTourAgainBlurb}>
      <Pressable
        onPress={onReplay}
        className="mt-2 min-h-[48px] items-center justify-center rounded-2xl border border-border bg-card px-4 py-3"
      >
        <Text className="font-bold text-primary">{copy.showTourAgainButton}</Text>
      </Pressable>
    </Card>
  );
}
