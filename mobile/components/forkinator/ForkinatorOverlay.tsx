import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  useWindowDimensions,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionEnabled } from '../../hooks/useReduceMotionEnabled';
import {
  FORKINATOR_ACCESSIBILITY_HINT,
  FORKINATOR_ACCESSIBILITY_LABEL,
} from '../../lib/forkinator/a11y';
import {
  FORKINATOR_HIT_HEIGHT_PX,
  FORKINATOR_HIT_INSET_LEFT_PX,
  FORKINATOR_HIT_INSET_TOP_PX,
  FORKINATOR_HIT_WIDTH_PX,
} from '../../lib/forkinator/hitArea';
import {
  FORKINATOR_GREETING_AUTO_HIDE_MS,
  FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS,
  markForkinatorGreetingShown,
  readForkinatorGreetingShown,
} from '../../lib/forkinator/greetingShown';
import {
  openPantryCameraScanFromForkinator,
  openPantryScannerFromForkinator,
  openPantryWithWebShelfScanFile,
} from '../../lib/forkinator/openPantryScanner';
import { canSyncForkinatorWebCameraScan } from '../../lib/forkinator/forkinatorWebCameraScan';
import { pickWebImageFile } from '../../lib/web/pickWebImageFile';
import { useApp } from '../../context/AppContext';
import { readForkinatorHasScanned } from '../../lib/forkinator/hasScanned';
import {
  FORKINATOR_GREETING_A11Y_LABEL,
  FORKINATOR_GREETING_MESSAGE,
  FORKINATOR_SCANNER_NUDGE_A11Y_LABEL,
  FORKINATOR_SCANNER_NUDGE_MESSAGE,
} from '../../lib/forkinator/scannerNudgeCopy';
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
import { layoutScannerPrompt } from '../../lib/forkinator/scannerPromptLayout';
import {
  FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS,
  markForkinatorScannerNudgeShown,
  resolveForkinatorMascotTapAction,
  shouldAutoShowForkinatorScannerPrompt,
} from '../../lib/forkinator/scannerNudgeCooldown';
import { isForkinatorTapRelease } from '../../lib/forkinator/tapGesture';
import { layoutThinkingBubble } from '../../lib/forkinator/thinkingBubbleLayout';
import {
  forkinatorDragSurfaceWebStyle,
  forkinatorMascotImageWebStyle,
} from '../../lib/forkinator/webTouchStyle';
import {
  resolveForkinatorMascotPose,
  type ForkinatorMascotPose,
} from '../../lib/forkinator/forkinatorPose';
import { ForkinatorScannerPrompt } from './ForkinatorScannerPrompt';
import { ForkinatorThinkingBubble } from './ForkinatorThinkingBubble';

const FORKINATOR_MASCOT_POSE_SOURCES: Record<ForkinatorMascotPose, number> = {
  full: require('../../assets/forkinator/forkinator-full.png'),
  idea: require('../../assets/forkinator/forkinator-idea.png'),
  thinking: require('../../assets/forkinator/forkinator-thinking.png'),
};
require('../../assets/forkinator/forkinator-sad.png');

const IS_WEB = Platform.OS === 'web';

type PointerTrack = {
  pointerId: number;
  startPageX: number;
  startPageY: number;
  startedAt: number;
  maxDistance: number;
};

export function ForkinatorOverlay() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const { demoMode, authReady, session, profile, profileReady, featureFlags } = useApp();
  const photoScanAccess = useMemo(
    () => ({
      demoMode,
      authReady,
      hasSession: Boolean(session),
      plan: profile.plan,
      role: profile.role,
      profileReady,
    }),
    [authReady, demoMode, profile.plan, profile.role, profileReady, session],
  );
  const [position, setPosition] = useState<ForkinatorPosition | null>(null);
  const [thinkingVisible, setThinkingVisible] = useState(false);
  const [greetingPromptVisible, setGreetingPromptVisible] = useState(false);
  const [scannerPromptVisible, setScannerPromptVisible] = useState(false);
  const positionRef = useRef<ForkinatorPosition | null>(null);
  const dragOrigin = useRef<ForkinatorPosition>({ x: 0, y: 0 });
  const pressStartedAt = useRef(0);
  const pointerTrackRef = useRef<PointerTrack | null>(null);
  const dragSurfaceRef = useRef<View>(null);
  const autoShowScheduledRef = useRef(false);
  const autoShowPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockScannerThisSessionRef = useRef(false);
  const greetingPromptVisibleRef = useRef(false);
  const scannerPromptVisibleRef = useRef(false);

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

  useEffect(() => {
    greetingPromptVisibleRef.current = greetingPromptVisible;
  }, [greetingPromptVisible]);

  useEffect(() => {
    scannerPromptVisibleRef.current = scannerPromptVisible;
  }, [scannerPromptVisible]);

  useEffect(() => {
    if (!greetingPromptVisible) return;
    const timer = setTimeout(() => setGreetingPromptVisible(false), FORKINATOR_GREETING_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [greetingPromptVisible]);

  const mascotReady = position !== null && width > 0 && height > 0;

  useEffect(() => {
    if (!mascotReady) return;
    if (autoShowScheduledRef.current) return;
    autoShowScheduledRef.current = true;

    if (!readForkinatorGreetingShown()) {
      blockScannerThisSessionRef.current = true;
      autoShowPromptTimerRef.current = setTimeout(() => {
        autoShowPromptTimerRef.current = null;
        markForkinatorGreetingShown();
        setGreetingPromptVisible(true);
      }, FORKINATOR_GREETING_AUTO_SHOW_DELAY_MS);
      return;
    }

    if (blockScannerThisSessionRef.current) return;
    if (!shouldAutoShowForkinatorScannerPrompt(readForkinatorHasScanned())) return;

    autoShowPromptTimerRef.current = setTimeout(() => {
      autoShowPromptTimerRef.current = null;
      if (blockScannerThisSessionRef.current) return;
      if (!shouldAutoShowForkinatorScannerPrompt(readForkinatorHasScanned())) return;
      markForkinatorScannerNudgeShown();
      setScannerPromptVisible(true);
    }, FORKINATOR_SCANNER_PROMPT_AUTO_SHOW_DELAY_MS);
  }, [mascotReady]);

  useEffect(() => {
    return () => {
      if (autoShowPromptTimerRef.current != null) {
        clearTimeout(autoShowPromptTimerRef.current);
        autoShowPromptTimerRef.current = null;
      }
    };
  }, []);

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

  const greetingPromptLayout = useMemo(() => {
    if (!position) return null;
    return layoutScannerPrompt({
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
      message: FORKINATOR_GREETING_MESSAGE,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const scannerPromptLayout = useMemo(() => {
    if (!position) return null;
    return layoutScannerPrompt({
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
      message: FORKINATOR_SCANNER_NUDGE_MESSAGE,
      includeCameraButton: true,
    });
  }, [height, insets.bottom, insets.left, insets.right, insets.top, position, width]);

  const handleScannerCameraPress = useCallback(() => {
    setScannerPromptVisible(false);
    markForkinatorScannerNudgeShown();
    if (!IS_WEB) {
      openPantryCameraScanFromForkinator();
      return;
    }
    if (!featureFlags.photoScan || !canSyncForkinatorWebCameraScan(photoScanAccess)) {
      openPantryScannerFromForkinator();
      return;
    }
    void (async () => {
      const file = await pickWebImageFile({ capture: 'environment' });
      if (!file) return;
      openPantryWithWebShelfScanFile(file);
    })();
  }, [featureFlags.photoScan, photoScanAccess]);

  const handleMascotActivate = useCallback(() => {
    const action = resolveForkinatorMascotTapAction(
      greetingPromptVisibleRef.current,
      scannerPromptVisibleRef.current,
    );
    if (action === 'dismissGreetingPrompt') {
      setGreetingPromptVisible(false);
      return;
    }
    if (action === 'dismissScannerPrompt') {
      setScannerPromptVisible(false);
      return;
    }
    setThinkingVisible((show) => !show);
  }, []);

  const applyDragDelta = useCallback(
    (dx: number, dy: number) => {
      const base = dragOrigin.current;
      const next = clampForkinatorPosition({ x: base.x + dx, y: base.y + dy }, bounds);
      setPosition(next);
    },
    [bounds],
  );

  const finishInteraction = useCallback(
    (dx: number, dy: number, durationMs: number) => {
      const base = dragOrigin.current;
      const next = clampForkinatorPosition({ x: base.x + dx, y: base.y + dy }, bounds);
      dragOrigin.current = next;
      setPosition(next);
      writeForkinatorPosition(next);

      if (isForkinatorTapRelease(dx, dy, durationMs)) {
        handleMascotActivate();
      }
    },
    [bounds, handleMascotActivate],
  );

  const panResponder = useMemo(() => {
    if (IS_WEB) {
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => false,
      });
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pressStartedAt.current = Date.now();
        const current = positionRef.current ?? defaultForkinatorPosition(bounds);
        dragOrigin.current = current;
      },
      onPanResponderMove: (_event, gesture) => {
        applyDragDelta(gesture.dx, gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        const durationMs = Date.now() - pressStartedAt.current;
        finishInteraction(gesture.dx, gesture.dy, durationMs);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [applyDragDelta, bounds, finishInteraction]);

  const endPointerInteraction = useCallback(
    (track: PointerTrack, pageX: number, pageY: number) => {
      const dx = pageX - track.startPageX;
      const dy = pageY - track.startPageY;
      const durationMs = Date.now() - track.startedAt;
      finishInteraction(dx, dy, durationMs);
      pointerTrackRef.current = null;
    },
    [finishInteraction],
  );

  const onPointerDown: NonNullable<ViewProps['onPointerDown']> = useCallback((event) => {
    if (!IS_WEB) return;
    const native = event.nativeEvent;
    const pointerId = native.pointerId ?? 0;
    pressStartedAt.current = Date.now();
    const current = positionRef.current ?? defaultForkinatorPosition(bounds);
    dragOrigin.current = current;
    pointerTrackRef.current = {
      pointerId,
      startPageX: native.pageX,
      startPageY: native.pageY,
      startedAt: Date.now(),
      maxDistance: 0,
    };
    const node = dragSurfaceRef.current as unknown as {
      setPointerCapture?: (id: number) => void;
    } | null;
    node?.setPointerCapture?.(pointerId);
    event.preventDefault();
  }, [bounds]);

  const onPointerMove: NonNullable<ViewProps['onPointerMove']> = useCallback((event) => {
    if (!IS_WEB) return;
    const track = pointerTrackRef.current;
    if (!track) return;
    const native = event.nativeEvent;
    if (native.pointerId !== track.pointerId) return;
    const dx = native.pageX - track.startPageX;
    const dy = native.pageY - track.startPageY;
    track.maxDistance = Math.max(track.maxDistance, Math.hypot(dx, dy));
    applyDragDelta(dx, dy);
    event.preventDefault();
  }, [applyDragDelta]);

  const onPointerUp: NonNullable<ViewProps['onPointerUp']> = useCallback((event) => {
    if (!IS_WEB) return;
    const track = pointerTrackRef.current;
    if (!track) return;
    const native = event.nativeEvent;
    if (native.pointerId !== track.pointerId) return;
    endPointerInteraction(track, native.pageX, native.pageY);
    event.preventDefault();
  }, [endPointerInteraction]);

  const onPointerCancel: NonNullable<ViewProps['onPointerCancel']> = useCallback((event) => {
    if (!IS_WEB) return;
    const track = pointerTrackRef.current;
    if (!track) return;
    endPointerInteraction(track, event.nativeEvent.pageX, event.nativeEvent.pageY);
  }, [endPointerInteraction]);

  const onKeyDown = useCallback(
    (event: { nativeEvent: { key: string }; preventDefault: () => void }) => {
      if (!IS_WEB) return;
      const key = event.nativeEvent.key;
      if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
      event.preventDefault();
      handleMascotActivate();
    },
    [handleMascotActivate],
  );

  if (!position || width <= 0 || height <= 0) return null;

  const webDragStyle = forkinatorDragSurfaceWebStyle();
  const imageWebStyle = forkinatorMascotImageWebStyle();
  const mascotPose = resolveForkinatorMascotPose({
    thinkingVisible,
    scannerPromptVisible,
    greetingPromptVisible,
  });
  const mascotSource = FORKINATOR_MASCOT_POSE_SOURCES[mascotPose];

  const dragInteractionProps: ViewProps = IS_WEB
    ? ({
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onKeyDown,
        tabIndex: 0,
      } as ViewProps)
    : panResponder.panHandlers;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-0"
      style={{ zIndex: 100001 }}
    >
      {greetingPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={greetingPromptLayout}
          visible={greetingPromptVisible}
          reduceMotion={reduceMotion}
          message={FORKINATOR_GREETING_MESSAGE}
          accessibilityLabel={FORKINATOR_GREETING_A11Y_LABEL}
          onPress={() => setGreetingPromptVisible(false)}
        />
      ) : null}
      {scannerPromptLayout ? (
        <ForkinatorScannerPrompt
          layout={scannerPromptLayout}
          visible={scannerPromptVisible && !greetingPromptVisible}
          reduceMotion={reduceMotion}
          message={FORKINATOR_SCANNER_NUDGE_MESSAGE}
          accessibilityLabel={FORKINATOR_SCANNER_NUDGE_A11Y_LABEL}
          onPress={() => {
            setScannerPromptVisible(false);
            openPantryScannerFromForkinator();
          }}
          onCameraPress={handleScannerCameraPress}
        />
      ) : null}
      {thinkingLayout ? (
        <ForkinatorThinkingBubble
          layout={thinkingLayout}
          visible={thinkingVisible}
          reduceMotion={reduceMotion}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: FORKINATOR_WIDTH_PX,
          height: FORKINATOR_HEIGHT_PX,
        }}
      >
        <Image
          source={mascotSource}
          style={[
            { width: FORKINATOR_WIDTH_PX, height: FORKINATOR_HEIGHT_PX },
            imageWebStyle,
          ]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          pointerEvents="none"
          {...(IS_WEB ? ({ draggable: false } as object) : null)}
        />
        <View
          ref={dragSurfaceRef}
          {...dragInteractionProps}
          accessible
          accessibilityRole="button"
          accessibilityLabel={FORKINATOR_ACCESSIBILITY_LABEL}
          accessibilityHint={FORKINATOR_ACCESSIBILITY_HINT}
          focusable
          style={{
            position: 'absolute',
            left: FORKINATOR_HIT_INSET_LEFT_PX,
            top: FORKINATOR_HIT_INSET_TOP_PX,
            width: FORKINATOR_HIT_WIDTH_PX,
            height: FORKINATOR_HIT_HEIGHT_PX,
            ...webDragStyle,
          }}
        />
      </View>
    </View>
  );
}
