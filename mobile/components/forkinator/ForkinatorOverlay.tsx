import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clampForkinatorPosition,
  defaultForkinatorPosition,
  FORKINATOR_SIZE_PX,
  readForkinatorPosition,
  writeForkinatorPosition,
  type ForkinatorBounds,
  type ForkinatorPosition,
} from '../../lib/forkinator/position';

const MASCOT_SOURCE = require('../../assets/forkinator/forkinator-head.png');

export function ForkinatorOverlay() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [position, setPosition] = useState<ForkinatorPosition | null>(null);
  const positionRef = useRef<ForkinatorPosition | null>(null);
  const dragOrigin = useRef<ForkinatorPosition>({ x: 0, y: 0 });

  const bounds: ForkinatorBounds = useMemo(
    () => ({
      width,
      height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      size: FORKINATOR_SIZE_PX,
    }),
    [height, insets.bottom, insets.left, insets.right, insets.top, width],
  );

  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    setPosition((current) => {
      if (current) return clampForkinatorPosition(current, bounds);
      const stored = readForkinatorPosition();
      return stored
        ? clampForkinatorPosition(stored, bounds)
        : defaultForkinatorPosition(bounds);
    });
  }, [bounds, height, width]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const current = positionRef.current ?? defaultForkinatorPosition(bounds);
          dragOrigin.current = current;
        },
        onPanResponderMove: (_event, gesture) => {
          const base = dragOrigin.current;
          const next = clampForkinatorPosition(
            { x: base.x + gesture.dx, y: base.y + gesture.dy },
            bounds,
          );
          setPosition(next);
        },
        onPanResponderRelease: (_event, gesture) => {
          const base = dragOrigin.current;
          const next = clampForkinatorPosition(
            { x: base.x + gesture.dx, y: base.y + gesture.dy },
            bounds,
          );
          dragOrigin.current = next;
          setPosition(next);
          writeForkinatorPosition(next);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [bounds],
  );

  if (!position || width <= 0 || height <= 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-0"
      style={{ zIndex: 100001 }}
    >
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Forkinator"
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: FORKINATOR_SIZE_PX,
          height: FORKINATOR_SIZE_PX,
        }}
      >
        <Image
          source={MASCOT_SOURCE}
          style={{ width: FORKINATOR_SIZE_PX, height: FORKINATOR_SIZE_PX }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}
