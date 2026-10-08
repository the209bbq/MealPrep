import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { Ionicons } from '../../lib/icons/Ionicons';
import {
  FORKINATOR_FORK_IN_ROAD_A11Y_LABEL,
  FORKINATOR_FORK_IN_ROAD_BUTTON_A11Y_LABEL,
  FORKINATOR_FORK_IN_ROAD_BUTTON_LABEL,
  FORKINATOR_FORK_IN_ROAD_MESSAGE,
  FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL,
  FORKINATOR_FORK_IN_ROAD_PILL_LABEL,
} from '../../lib/forkinator/forkInRoadPromptCopy';
import type { ForkInRoadPillLayout } from '../../lib/forkinator/forkInRoadPillLayout';
import type { ScannerPromptLayout } from '../../lib/forkinator/scannerPromptLayout';
import {
  SCANNER_PROMPT_BORDER_RADIUS,
  SCANNER_PROMPT_CAMERA_BUTTON_HEIGHT,
  SCANNER_PROMPT_CAMERA_BUTTON_MARGIN_TOP,
  SCANNER_PROMPT_FONT_SIZE,
  SCANNER_PROMPT_HORIZONTAL_PADDING,
  SCANNER_PROMPT_LINE_HEIGHT,
  PROMPT_BUBBLE_TAIL_GAP,
  type ScannerPromptPlacement,
} from '../../lib/forkinator/scannerPromptLayout';
const OUTLINE = '#D1D5DB';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type ForkInRoadPromptProps = {
  pillLayout: ForkInRoadPillLayout;
  cloudLayout: ScannerPromptLayout;
  expanded: boolean;
  visible: boolean;
  reduceMotion: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onHelpPress: () => void;
};

function TailCircles({ placement }: { placement: ScannerPromptPlacement }) {
  const sizes = [10, 7, 5];
  if (placement === 'left' || placement === 'right') {
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

function ExpandedForkInRoadCloud({
  layout,
  reduceMotion,
  onCollapse,
  onHelpPress,
}: {
  layout: ScannerPromptLayout;
  reduceMotion: boolean;
  onCollapse: () => void;
  onHelpPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const isSide = layout.placement === 'left' || layout.placement === 'right';
  const tailFirst = layout.placement === 'below' || layout.placement === 'right';

  useEffect(() => {
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
  }, [opacity, reduceMotion]);

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
    <View style={bodyStyle} pointerEvents="box-none">
      <Pressable
        onPress={onCollapse}
        accessibilityRole="button"
        accessibilityLabel="Collapse meal suggestion"
        hitSlop={8}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <Text style={{ fontSize: 16, lineHeight: 18, color: THEME.muted }}>×</Text>
      </Pressable>
      <Text
        pointerEvents="none"
        style={{
          width: '100%',
          fontSize: SCANNER_PROMPT_FONT_SIZE,
          lineHeight: SCANNER_PROMPT_LINE_HEIGHT,
          color: THEME.ink,
          textAlign: 'center',
          paddingRight: 12,
        }}
      >
        {FORKINATOR_FORK_IN_ROAD_MESSAGE}
      </Text>
      <Pressable
        onPress={onHelpPress}
        accessibilityRole="button"
        accessibilityLabel={FORKINATOR_FORK_IN_ROAD_BUTTON_A11Y_LABEL}
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
        <Text
          pointerEvents="none"
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: THEME.onPrimary,
          }}
        >
          {FORKINATOR_FORK_IN_ROAD_BUTTON_LABEL}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <Pressable
        accessibilityLabel={FORKINATOR_FORK_IN_ROAD_A11Y_LABEL}
        onPress={onCollapse}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
        }}
      />
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
          zIndex: 1,
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
    </>
  );
}

export function ForkInRoadPrompt({
  pillLayout,
  cloudLayout,
  expanded,
  visible,
  reduceMotion,
  onExpand,
  onCollapse,
  onHelpPress,
}: ForkInRoadPromptProps) {
  const pillOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || expanded) {
      pillOpacity.setValue(0);
      return;
    }
    if (reduceMotion) {
      pillOpacity.setValue(1);
      return;
    }
    pillOpacity.setValue(0);
    Animated.timing(pillOpacity, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [expanded, pillOpacity, reduceMotion, visible]);

  if (!visible) return null;

  if (expanded) {
    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        <ExpandedForkInRoadCloud
          layout={cloudLayout}
          reduceMotion={reduceMotion}
          onCollapse={onCollapse}
          onHelpPress={onHelpPress}
        />
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: pillLayout.left,
        top: pillLayout.top,
        width: pillLayout.width,
        height: pillLayout.height,
        opacity: pillOpacity,
      }}
    >
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel={FORKINATOR_FORK_IN_ROAD_PILL_A11Y_LABEL}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          height: pillLayout.height,
          minWidth: pillLayout.width,
          paddingHorizontal: 10,
          borderRadius: pillLayout.height / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: OUTLINE,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        <Ionicons name="bulb-outline" size={14} color={THEME.primary} />
        <Text
          pointerEvents="none"
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: THEME.ink,
          }}
        >
          {FORKINATOR_FORK_IN_ROAD_PILL_LABEL}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
