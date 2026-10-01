import { Pressable, Text, View } from 'react-native';

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  return (
    <View className="absolute bottom-6 left-4 right-4 z-50">
      <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-ink px-4 py-3 shadow-lg">
        <Text className="flex-1 text-sm font-medium text-paper" numberOfLines={2}>{message}</Text>
        <Pressable onPress={onUndo} className="rounded-full bg-primary px-3 py-1.5">
          <Text className="text-xs font-bold text-on-primary">Undo</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8} className="px-1">
          <Text className="text-lg leading-none text-muted">×</Text>
        </Pressable>
      </View>
    </View>
  );
}
