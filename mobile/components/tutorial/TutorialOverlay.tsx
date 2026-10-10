import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { TUTORIAL, TUTORIAL_COPY, TUTORIAL_STEPS, type TutorialStep } from '../../config/tutorial';
import { useApp } from '../../context/AppContext';
import { useTutorialState } from '../../hooks/useTutorial';
import { markForkinatorGreetingShown } from '../../lib/forkinator/greetingShown';
import {
  appColumnSideInset,
  APP_COLUMN_MAX_WIDTH_PX,
  FORKINATOR_PINNED_HEIGHT_PX,
  FORKINATOR_PINNED_WIDTH_PX,
  isForkinatorTabRoute,
  pinnedForkinatorPosition,
} from '../../lib/forkinator/pinnedDock';
import {
  endTutorial,
  measureTutorialTarget,
  nextTutorialStep,
  previousTutorialStep,
  shouldAutoStartTutorial,
  spotlightForRect,
  startTutorial,
  tutorialCardPlacement,
  type TutorialRect,
} from '../../lib/tutorial/tutorialStore';

const FORKY_IMAGE: number = require('../../assets/forkinator/forkinator-full.png');
const DIM = 'rgba(27, 42, 32, 0.66)';
const CARD_SIDE_MARGIN_PX = 16;
/** Tallest the card gets (sample list step); used to keep it on screen. */
const CARD_MAX_HEIGHT_PX = 300;
const AUTO_START_DELAY_MS = 1200;

function sameRect(a: TutorialRect | null, b: TutorialRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

function onStepRoute(pathname: string, step: TutorialStep): boolean {
  const path = pathname.split('?')[0].replace('/(tabs)', '');
  const normalized = path === '' || path === '/index' ? '/' : path;
  return normalized === step.route;
}

/** Greys the page; swallows taps so only the lit-up area and Forky's card respond. */
function Shade({ left, top, width, height }: { left: number; top: number; width: number; height: number }) {
  if (width <= 0 || height <= 0) return null;
  return (
    <Pressable
      accessible={false}
      onPress={() => {}}
      style={{ position: 'absolute', left, top, width, height, backgroundColor: DIM }}
    />
  );
}

/**
 * First-time tour. The page greys out, Forky's card explains one thing, and the thing itself is
 * lit up and can be pressed. "Skip tour" is on every step.
 */
export function TutorialOverlay() {
  const { active, stepIndex } = useTutorialState();
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const { featureFlags, profile, demoMode } = useApp();
  const [measured, setMeasured] = useState<TutorialRect | null>(null);

  const step = TUTORIAL_STEPS[Math.min(stepIndex, TUTORIAL_STEPS.length - 1)];
  const routeReady = onStepRoute(pathname, step);

  // New visitors get the tour once (only when it is switched on for everyone).
  useEffect(() => {
    if (!shouldAutoStartTutorial()) return;
    const timer = setTimeout(() => {
      if (shouldAutoStartTutorial() && isForkinatorTabRoute(pathname)) startTutorial();
    }, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  // The tour is Forky's introduction: his separate one-line greeting is not needed after it.
  useEffect(() => {
    if (active) markForkinatorGreetingShown();
  }, [active]);

  // Each step happens on its own tab.
  useEffect(() => {
    if (!active || routeReady) return;
    router.navigate(step.route);
  }, [active, routeReady, step.route]);

  // Find the element to light up, and keep finding it while the screen settles.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const apply = (rect: TutorialRect | null) => {
      if (cancelled) return;
      setMeasured((previous) => (sameRect(previous, rect) ? previous : rect));
    };
    const measure = () => {
      if (!routeReady || step.target == null) {
        apply(null);
        return;
      }
      if (step.target === 'forky') {
        const position = pinnedForkinatorPosition(width);
        apply({ x: position.x, y: position.y, width: FORKINATOR_PINNED_WIDTH_PX, height: FORKINATOR_PINNED_HEIGHT_PX });
        return;
      }
      measureTutorialTarget(step.target, apply);
    };
    measure();
    const timer = setInterval(measure, TUTORIAL.remeasureMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, routeReady, step.target, width]);

  if (!active || width <= 0 || height <= 0) return null;

  const screen = { width, height, bottomBarHeight: TUTORIAL.tabBarHeightPx };
  const spotlight = routeReady ? spotlightForRect(measured, screen) : null;
  const placement = tutorialCardPlacement(spotlight, screen);
  const columnInset = appColumnSideInset(width);
  const cardWidth = Math.min(width, APP_COLUMN_MAX_WIDTH_PX) - CARD_SIDE_MARGIN_PX * 2;
  const usableBottom = height - TUTORIAL.tabBarHeightPx;

  // Keep the whole card on screen whatever was lit up.
  let cardTop: number;
  if (placement.anchor === 'top') {
    cardTop = Math.min(placement.top, usableBottom - CARD_MAX_HEIGHT_PX);
  } else if (placement.anchor === 'bottom') {
    cardTop = Math.max(12, height - placement.bottom - CARD_MAX_HEIGHT_PX);
  } else {
    cardTop = Math.max(12, (usableBottom - CARD_MAX_HEIGHT_PX) / 2);
  }
  cardTop = Math.max(12, cardTop);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= TUTORIAL_STEPS.length - 1;
  const askForkyAvailable = (featureFlags.askForky || profile.role === 'admin') && !demoMode;
  const message = step.id === 'ask' ? (askForkyAvailable ? TUTORIAL_COPY.askForkyOn : TUTORIAL_COPY.askForkyOff) : step.message;

  return (
    <View pointerEvents="box-none" className="absolute inset-0" style={{ zIndex: 100002 }}>
      {spotlight ? (
        <>
          <Shade left={0} top={0} width={width} height={spotlight.y} />
          <Shade left={0} top={spotlight.y} width={spotlight.x} height={spotlight.height} />
          <Shade
            left={spotlight.x + spotlight.width}
            top={spotlight.y}
            width={width - spotlight.x - spotlight.width}
            height={spotlight.height}
          />
          <Shade
            left={0}
            top={spotlight.y + spotlight.height}
            width={width}
            height={height - spotlight.y - spotlight.height}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spotlight.x,
              top: spotlight.y,
              width: spotlight.width,
              height: spotlight.height,
              borderRadius: 14,
              borderWidth: 2.5,
              borderColor: THEME.brandCream,
            }}
          />
        </>
      ) : (
        <Shade left={0} top={0} width={width} height={height} />
      )}

      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left: columnInset + CARD_SIDE_MARGIN_PX,
          top: cardTop,
          width: cardWidth,
          borderRadius: 20,
          backgroundColor: THEME.card,
          padding: 16,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold text-muted">
            {TUTORIAL_COPY.progress(stepIndex + 1, TUTORIAL_STEPS.length)}
          </Text>
          <Pressable
            onPress={endTutorial}
            accessibilityRole="button"
            accessibilityLabel={TUTORIAL_COPY.skip}
            className="min-h-[44px] items-end justify-center pl-4"
            hitSlop={8}
          >
            <Text className="text-sm font-bold text-muted">{TUTORIAL_COPY.skip}</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-3">
          <Image
            source={FORKY_IMAGE}
            accessibilityLabel="Forky"
            contentFit="contain"
            style={{ width: 34, height: 93 }}
          />
          <View className="min-w-0 flex-1">
            <Text accessibilityRole="header" className="text-[17px] font-extrabold leading-[22px] text-ink">
              {step.title}
            </Text>
            <Text className="mt-1.5 text-[15px] leading-[21px] text-ink">{message}</Text>
            {step.sample === 'scan-review' ? (
              <View className="mt-3 rounded-[14px] border border-border bg-paper px-3 py-2.5">
                <Text className="text-xs font-bold text-muted">
                  {TUTORIAL_COPY.sampleListTitle} · {TUTORIAL_COPY.sampleNote}
                </Text>
                {TUTORIAL_COPY.sampleItems.map((item) => (
                  <Text key={item} className="mt-1 text-sm text-ink">
                    ✓ {item}
                  </Text>
                ))}
                <View className="mt-2 self-start rounded-full bg-primary px-3 py-1.5">
                  <Text className="text-xs font-bold text-on-primary">{TUTORIAL_COPY.sampleButton}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View className="mt-3 flex-row items-center justify-end gap-2">
          {!isFirst ? (
            <Pressable
              onPress={previousTutorialStep}
              accessibilityRole="button"
              className="min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-5"
            >
              <Text className="text-[15px] font-bold text-primary">{TUTORIAL_COPY.back}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={nextTutorialStep}
            accessibilityRole="button"
            className="min-h-[44px] items-center justify-center rounded-full bg-primary px-6"
          >
            <Text className="text-[15px] font-bold text-on-primary">
              {isLast ? TUTORIAL_COPY.done : TUTORIAL_COPY.next}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
