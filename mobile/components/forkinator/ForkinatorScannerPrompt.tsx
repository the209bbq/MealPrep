import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import {
  SCANNER_PROMPT_BORDER_RADIUS,
  SCANNER_PROMPT_FONT_SIZE,
  SCANNER_PROMPT_HORIZONTAL_PADDING,
  SCANNER_PROMPT_LINE_HEIGHT,
  type ScannerPromptLayout,
  type ScannerPromptPlacement,
} from '../../lib/forkinator/scannerPromptLayout';
import { THINKING_BUBBLE_TAIL_GAP } from '../../lib/forkinator/thinkingBubbleLayout';

const OUTLINE = '#D1D5DB';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type ForkinatorScannerPromptProps = {
  layout: ScannerPromptLayout;
  visible: boolean;
  reduceMotion: boolean;
  message: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function TailCircles({ placement }: { placement: ScannerPromptPlacement }) {
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

export function ForkinatorScannerPrompt({
  layout,
  visible,
  reduceMotion,
  message,
  accessibilityLabel,
  onPress,
}: ForkinatorScannerPromptProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [opacity, reduceMotion, visible]);

  if (!visible) return null;

  const cloudFirst = layout.placement === 'below';

  const bodyStyle = {
    width: layout.bodyWidth,
    minHeight: layout.bodyHeight,
    borderRadius: SCANNER_PROMPT_BORDER_RADIUS,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: OUTLINE,
    paddingHorizontal: SCANNER_PROMPT_HORIZONTAL_PADDING,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  };

  const body = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={bodyStyle}
    >
      <Text
        pointerEvents="none"
        style={{
          width: '100%',
          fontSize: SCANNER_PROMPT_FONT_SIZE,
          lineHeight: SCANNER_PROMPT_LINE_HEIGHT,
          color: THEME.ink,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </Pressable>
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: layout.left,
        top: layout.top,
        width: layout.width,
        opacity,
        alignItems: 'center',
      }}
    >
      {cloudFirst ? (
        <>
          <TailCircles placement={layout.placement} />
          {body}
        </>
      ) : (
        <>
          {body}
          <TailCircles placement={layout.placement} />
        </>
      )}
    </Animated.View>
  );
}
