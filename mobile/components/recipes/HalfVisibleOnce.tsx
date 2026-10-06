import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

/** Fires once when ~half visible (web IntersectionObserver; native on mount). */
export function HalfVisibleOnce({
  children,
  onVisible,
}: {
  children: React.ReactNode;
  onVisible: () => void;
}) {
  const ref = useRef<View>(null);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (fired) return;
    if (Platform.OS !== 'web') {
      setFired(true);
      onVisible();
      return;
    }
    const node = ref.current as unknown as HTMLElement | null;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setFired(true);
      onVisible();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.5) {
            setFired(true);
            onVisible();
            observer.disconnect();
          }
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fired, onVisible]);

  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  );
}
