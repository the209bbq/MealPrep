import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import {
  THINKING_BUBBLE_CLOUD_HEIGHT,
  THINKING_BUBBLE_CLOUD_WIDTH,
  THINKING_BUBBLE_TAIL_GAP,
  type ThinkingBubbleLayout,
  type ThinkingBubblePlacement,
} from '../../lib/forkinator/thinkingBubbleLayout';

const DOT_SIZE = 6;
const OUTLINE = '#D1D5DB';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type ForkinatorThinkingBubbleProps = {
  layout: ThinkingBubbleLayout;
  visible: boolean;
  reduceMotion: boolean;
};

function TailCircles({ placement }: { placement: ThinkingBubblePlacement }) {
  const sizes = [10, 7, 5];
  const isAbove = placement === 'above';
  return (
    <View
      pointerEvents="none"
      style={{
        alignItems: 'center',
        marginTop: isAbove ? THINKING_BUBBLE_TAIL_GAP : 0,
        marginBottom: isAbove ? 0 : THINKING_BUBBLE_TAIL_GAP,
        transform: isAbove ? undefined : [{ scaleY: -1 }],
      }}
    >
      {sizes.map((size) => (
        <View
          key={size}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: OUTLINE,
            marginTop: size === sizes[0] ? 0 : 3,
          }}
        />
      ))}
    </View>
  );
}

function ThinkingDots({ reduceMotion }: { reduceMotion: boolean }) {
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reduceMotion) {
      dot1.setValue(0.65);
      dot2.setValue(0.65);
      dot3.setValue(0.65);
      return;
    }

    const makePulse = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      );

    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 140);
    const a3 = makePulse(dot3, 280);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3, reduceMotion]);

  const dots = [dot1, dot2, dot3];
  return (
    <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {dots.map((opacity, index) => (
        <Animated.View
          key={index}
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: THEME.muted,
            opacity,
          }}
        />
      ))}
    </View>
  );
}

export function ForkinatorThinkingBubble({
  layout,
  visible,
  reduceMotion,
}: ForkinatorThinkingBubbleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(reduceMotion ? 1 : 0.92);
      return;
    }
    if (reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.92);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [opacity, reduceMotion, scale, visible]);

  if (!visible) return null;

  const cloudFirst = layout.placement === 'below';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: layout.left,
        top: layout.top,
        width: layout.width,
        opacity,
        transform: [{ scale }],
        alignItems: 'center',
      }}
    >
      {cloudFirst ? (
        <>
          <TailCircles placement={layout.placement} />
          <Cloud reduceMotion={reduceMotion} />
        </>
      ) : (
        <>
          <Cloud reduceMotion={reduceMotion} />
          <TailCircles placement={layout.placement} />
        </>
      )}
    </Animated.View>
  );
}

function Cloud({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        width: THINKING_BUBBLE_CLOUD_WIDTH,
        height: THINKING_BUBBLE_CLOUD_HEIGHT,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: OUTLINE,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      <ThinkingDots reduceMotion={reduceMotion} />
    </View>
  );
}
