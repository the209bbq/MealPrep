import { useCallback, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, View, type RefreshControlProps } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { THEME } from '../config/appConfig';
import { touchPageYFromNativeEvent } from '../lib/home/touchPageY';

const PULL_THRESHOLD_PX = 80;

export function useHomeScrollRefresh(options: {
  enabled: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}): {
  refreshControl: ReactElement<RefreshControlProps> | undefined;
  scrollViewProps: Record<string, unknown>;
  pullIndicatorOffset: number;
  pullDistance: number;
} {
  const { enabled, refreshing, onRefresh } = options;
  const scrollY = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onTouchStart = useCallback((event: { nativeEvent: Record<string, unknown> }) => {
    if (!enabled || refreshing) return;
    const y = touchPageYFromNativeEvent(
      event.nativeEvent as Parameters<typeof touchPageYFromNativeEvent>[0],
      'start',
    );
    touchStartY.current = y;
  }, [enabled, refreshing]);

  const onTouchMove = useCallback((event: { nativeEvent: Record<string, unknown> }) => {
    if (!enabled || refreshing || touchStartY.current == null || scrollY.current > 2) return;
    const pageY = touchPageYFromNativeEvent(
      event.nativeEvent as Parameters<typeof touchPageYFromNativeEvent>[0],
      'move',
    );
    if (pageY == null) return;
    const delta = pageY - touchStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta, 140));
    }
  }, [enabled, refreshing]);

  const onTouchEnd = useCallback((event: { nativeEvent: Record<string, unknown> }) => {
    if (!enabled || refreshing) {
      touchStartY.current = null;
      setPullDistance(0);
      return;
    }
    const endY = touchPageYFromNativeEvent(
      event.nativeEvent as Parameters<typeof touchPageYFromNativeEvent>[0],
      'end',
    );
    if (endY != null && touchStartY.current != null) {
      const delta = endY - touchStartY.current;
      if (delta >= PULL_THRESHOLD_PX) {
        onRefresh();
      }
    } else if (pullDistance >= PULL_THRESHOLD_PX) {
      onRefresh();
    }
    touchStartY.current = null;
    setPullDistance(0);
  }, [enabled, onRefresh, pullDistance, refreshing]);

  const showPull = enabled && (pullDistance > 6 || refreshing);

  return {
    refreshControl: undefined,
    scrollViewProps: enabled
      ? {
          onScroll,
          onTouchStart,
          onTouchMove,
          onTouchEnd,
          scrollEventThrottle: 16,
        }
      : {},
    pullIndicatorOffset: showPull ? (refreshing ? 40 : Math.min(pullDistance * 0.4, 40)) : 0,
    pullDistance,
  };
}

export function HomeWebPullRefreshIndicator({
  visible,
  refreshing,
  pullDistance = 0,
}: {
  visible: boolean;
  refreshing: boolean;
  pullDistance?: number;
}) {
  if (!visible) return null;
  const ready = !refreshing && pullDistance >= PULL_THRESHOLD_PX;
  return (
    <View className="items-center justify-center py-2" accessibilityLiveRegion="polite">
      <ActivityIndicator
        color={THEME.primary}
        animating={refreshing || pullDistance > 12}
      />
      {!refreshing && pullDistance > 12 ? (
        <View
          className={`mt-1 h-1 rounded-full bg-primary/30 ${ready ? 'opacity-100' : 'opacity-70'}`}
          style={{ width: Math.min(48, 16 + pullDistance * 0.25) }}
        />
      ) : null}
    </View>
  );
}
