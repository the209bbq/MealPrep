import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionEnabled } from '../../hooks/useReduceMotionEnabled';
import {
  clampForkinatorPosition,
  defaultForkinatorPosition,
  FORKINATOR_HEIGHT_PX,
  FORKINATOR_WIDTH_PX,
  readForkinatorPosition,
  writeForkinatorPosition,
  type ForkinatorBounds,
  type ForkinatorPosition,
} from '../../lib/forkinator/position';
import { isForkinatorTapRelease } from '../../lib/forkinator/tapGesture';
import { layoutThinkingBubble } from '../../lib/forkinator/thinkingBubbleLayout';
import { ForkinatorThinkingBubble } from './ForkinatorThinkingBubble';

const MASCOT_SOURCE = require('../../assets/forkinator/forkinator-full.png');

export function ForkinatorOverlay() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const [position, setPosition] = useState<ForkinatorPosition | null>(null);
  const [thinkingVisible, setThinkingVisible] = useState(false);
  const positionRef = useRef<ForkinatorPosition | null>(null);
  const dragOrigin = useRef<ForkinatorPosition>({ x: 0, y: 0 });
  const pressStartedAt = useRef(0);

  const bounds: ForkinatorBounds = useMemo(
    () => ({
      width,
      height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
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

  const thinkingLayout = useMemo(() => {
    if (!position) return null;
    return layoutThinkingBubble({
      mascotX: position.x,
      mascotY: position.y,
      mascotWidth: FORKINATOR_WIDTH_PX,
      mascotHeight: FORKINATOR_HEIGHT_PX,
      screenWidth: width,
      screenHeight: height,
      insetTop: insets.top,
      insetRight: insets.right,
      insetBottom: insets.bottom,
      insetLeft: insets.left,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pressStartedAt.current = Date.now();
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

          const durationMs = Date.now() - pressStartedAt.current;
          if (isForkinatorTapRelease(gesture.dx, gesture.dy, durationMs)) {
            setThinkingVisible((show) => !show);
          }
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
      {thinkingLayout ? (
        <ForkinatorThinkingBubble
          layout={thinkingLayout}
          visible={thinkingVisible}
          reduceMotion={reduceMotion}
        />
      ) : null}
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Forkinator"
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: FORKINATOR_WIDTH_PX,
          height: FORKINATOR_HEIGHT_PX,
        }}
      >
        <Image
          source={MASCOT_SOURCE}
          style={{ width: FORKINATOR_WIDTH_PX, height: FORKINATOR_HEIGHT_PX }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}
