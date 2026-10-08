import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { Ionicons } from '../../lib/icons/Ionicons';
import {
  SCANNER_PROMPT_BORDER_RADIUS,
  SCANNER_PROMPT_CAMERA_BUTTON_HEIGHT,
  SCANNER_PROMPT_CAMERA_BUTTON_MARGIN_TOP,
  SCANNER_PROMPT_FONT_SIZE,
  SCANNER_PROMPT_HORIZONTAL_PADDING,
  SCANNER_PROMPT_LINE_HEIGHT,
  PROMPT_BUBBLE_TAIL_GAP,
  type ScannerPromptLayout,
  type ScannerPromptPlacement,
} from '../../lib/forkinator/scannerPromptLayout';

const OUTLINE = '#D1D5DB';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export type ForkinatorPromptActionButton = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  icon?: 'camera';
};

type ForkinatorScannerPromptProps = {
  layout: ScannerPromptLayout;
  visible: boolean;
  reduceMotion: boolean;
  message: string;
  accessibilityLabel: string;
  onPress: () => void;
  actionButton?: ForkinatorPromptActionButton;
};

function TailCircles({ placement }: { placement: ScannerPromptPlacement }) {
  const sizes = [10, 7, 5];
  if (placement === 'left' || placement === 'right') {
    // Side cloud: tail runs horizontally toward Forky's head, biggest circle by the cloud.
    const ordered = placement === 'left' ? sizes : [...sizes].reverse();
    return (
      <View
        pointerEvents="none"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          marginTop: 14,
          marginLeft: placement === 'left' ? PROMPT_BUBBLE_TAIL_GAP : 0,
          marginRight: placement === 'right' ? PROMPT_BUBBLE_TAIL_GAP : 0,
        }}
      >
        {ordered.map((size, index) => (
          <View
            key={size}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: OUTLINE,
              marginLeft: index === 0 ? 0 : 3,
            }}
          />
        ))}
      </View>
    );
  }
  const isAbove = placement === 'above';
  return (
    <View
      pointerEvents="none"
      style={{
        alignItems: 'center',
        marginTop: isAbove ? PROMPT_BUBBLE_TAIL_GAP : 0,
        marginBottom: isAbove ? 0 : PROMPT_BUBBLE_TAIL_GAP,
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
  actionButton,
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

  const isSide = layout.placement === 'left' || layout.placement === 'right';
  // Tail sits between the cloud and Forky: before the body when the cloud is below him or to his right.
  const tailFirst = layout.placement === 'below' || layout.placement === 'right';

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
    <View style={bodyStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
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
      {actionButton ? (
        <Pressable
          onPress={actionButton.onPress}
          accessibilityRole="button"
          accessibilityLabel={actionButton.accessibilityLabel}
          style={{
            marginTop: SCANNER_PROMPT_CAMERA_BUTTON_MARGIN_TOP,
            height: SCANNER_PROMPT_CAMERA_BUTTON_HEIGHT,
            borderRadius: SCANNER_PROMPT_CAMERA_BUTTON_HEIGHT / 2,
            backgroundColor: THEME.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            paddingHorizontal: 10,
          }}
        >
          {actionButton.icon === 'camera' ? (
            <Ionicons name="camera-outline" size={14} color={THEME.onPrimary} />
          ) : null}
          <Text
            pointerEvents="none"
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: THEME.onPrimary,
            }}
          >
            {actionButton.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
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
        alignItems: isSide ? 'flex-start' : 'center',
        flexDirection: isSide ? 'row' : 'column',
      }}
    >
      {tailFirst ? (
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
