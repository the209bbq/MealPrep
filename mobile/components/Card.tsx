import { Text, View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  subtitleClassName?: string;
}

export function Card({
  title,
  subtitle,
  subtitleClassName,
  children,
  className,
  ...props
}: CardProps & { className?: string }) {
  return (
    <View className={`rounded-[18px] border border-border bg-card p-4 ${className ?? ''}`} {...props}>
      {title ? <Text className="text-lg font-bold text-ink">{title}</Text> : null}
      {subtitle ? (
        <Text className={subtitleClassName ?? 'mt-1 text-sm text-muted'}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}
