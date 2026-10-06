import { useCallback, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, View, type RefreshControlProps } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { THEME } from '../config/appConfig';

const PULL_THRESHOLD_PX = 72;

export function useHomeScrollRefresh(options: {
  enabled: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}): {
  refreshControl: ReactElement<RefreshControlProps> | undefined;
  scrollViewProps: Record<string, unknown>;
  pullIndicatorOffset: number;
} {
  const { enabled, refreshing, onRefresh } = options;
  const scrollY = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onTouchStart = useCallback((event: { nativeEvent: { pageY: number } }) => {
    if (!enabled || refreshing) return;
    touchStartY.current = event.nativeEvent.pageY;
  }, [enabled, refreshing]);

  const onTouchMove = useCallback((event: { nativeEvent: { pageY: number } }) => {
    if (!enabled || refreshing || touchStartY.current == null || scrollY.current > 2) return;
    const delta = event.nativeEvent.pageY - touchStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta, 120));
    }
  }, [enabled, refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!enabled || refreshing) {
      touchStartY.current = null;
      setPullDistance(0);
      return;
    }
    if (pullDistance >= PULL_THRESHOLD_PX) {
      onRefresh();
    }
    touchStartY.current = null;
    setPullDistance(0);
  }, [enabled, onRefresh, pullDistance, refreshing]);

  const showPull = enabled && (pullDistance > 8 || refreshing);

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
    pullIndicatorOffset: showPull ? (refreshing ? 36 : Math.min(pullDistance * 0.35, 36)) : 0,
  };
}

export function HomeWebPullRefreshIndicator({
  visible,
  refreshing,
}: {
  visible: boolean;
  refreshing: boolean;
}) {
  if (!visible) return null;
  return (
    <View className="items-center justify-center py-2" accessibilityLiveRegion="polite">
      <ActivityIndicator color={THEME.primary} animating={refreshing || visible} />
    </View>
  );
}
