import type { ReactElement } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { THEME } from '../config/appConfig';

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
  return {
    refreshControl: enabled
      ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.primary]}
            tintColor={THEME.primary}
          />
        )
      : undefined,
    scrollViewProps: {},
    pullIndicatorOffset: 0,
  };
}

export function HomeWebPullRefreshIndicator(_props: {
  visible: boolean;
  refreshing: boolean;
}): null {
  return null;
}
