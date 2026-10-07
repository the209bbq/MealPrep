import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { UNDO_TOAST_AUTO_DISMISS_MS, UNDO_TOAST_BOTTOM_OFFSET_PX } from '../config/undoToast';

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  showUndo?: boolean;
}

const WEB_TOAST_Z_INDEX = 2_147_483_000;

function UndoToastCard({
  message,
  onUndo,
  onDismiss,
  actionLabel,
  onAction,
  showUndo = true,
}: UndoToastProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.toastAnchor, { bottom: UNDO_TOAST_BOTTOM_OFFSET_PX }]}
    >
      <View
        pointerEvents="auto"
        className="mx-4 flex-row items-center justify-between gap-2 rounded-2xl border border-border bg-ink px-4 py-3 shadow-lg"
      >
        <Text className="flex-1 text-sm font-medium text-paper" numberOfLines={2}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            className="rounded-full border border-primary-accent bg-primary/20 px-3 py-1.5"
          >
            <Text className="text-xs font-bold text-primary-accent">{actionLabel}</Text>
          </Pressable>
        ) : null}
        {showUndo ? (
          <Pressable
            onPress={onUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            className="rounded-full bg-primary px-3 py-1.5"
          >
            <Text className="text-xs font-bold text-on-primary">Undo</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          className="px-1"
        >
          <Text className="text-lg leading-none text-muted">×</Text>
        </Pressable>
      </View>
    </View>
  );
}

function UndoToastNativeLayer(props: UndoToastProps) {
  return (
    <View pointerEvents="box-none" style={styles.nativeOverlay}>
      <UndoToastCard {...props} />
    </View>
  );
}

function UndoToastWebPortal({ children }: { children: ReactNode }) {
  const [canPortal, setCanPortal] = useState(false);
  useEffect(() => {
    setCanPortal(true);
  }, []);
  if (!canPortal || typeof document === 'undefined') return null;
  return createPortal(
    <div
      id="mealplanatic-undo-toast-layer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: WEB_TOAST_Z_INDEX,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  actionLabel,
  onAction,
  showUndo = true,
}: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(), UNDO_TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  const cardProps = {
    message,
    onUndo,
    onDismiss,
    actionLabel,
    onAction,
    showUndo,
  };

  if (Platform.OS === 'web') {
    return (
      <UndoToastWebPortal>
        <UndoToastNativeLayer {...cardProps} />
      </UndoToastWebPortal>
    );
  }

  return <UndoToastNativeLayer {...cardProps} />;
}

const styles = StyleSheet.create({
  nativeOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100_000,
    elevation: 100_000,
  },
  toastAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100_001,
  },
});
