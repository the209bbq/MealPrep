import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { UNDO_TOAST_AUTO_DISMISS_MS, UNDO_TOAST_BOTTOM_OFFSET_PX } from '../config/undoToast';

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function UndoToast({ message, onUndo, onDismiss, actionLabel, onAction }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(), UNDO_TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-4 right-4 z-50"
      style={{ bottom: UNDO_TOAST_BOTTOM_OFFSET_PX }}
    >
      <View className="flex-row items-center justify-between gap-2 rounded-2xl border border-border bg-ink px-4 py-3 shadow-lg">
        <Text className="flex-1 text-sm font-medium text-paper" numberOfLines={2}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} className="rounded-full border border-primary-accent bg-primary/20 px-3 py-1.5">
            <Text className="text-xs font-bold text-primary-accent">{actionLabel}</Text>
          </Pressable>
        ) : null}
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
