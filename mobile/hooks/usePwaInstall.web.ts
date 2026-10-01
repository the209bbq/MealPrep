import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHydrated } from './useHydrated';

const DISMISS_KEY = 'mealprep.pwaInstallDismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const hydrated = useHydrated();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setDismissed(readDismissed());
    setStandalone(detectStandalone());
  }, [hydrated]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onDisplayMode = () => setStandalone(detectStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onDisplayMode);
    };
  }, []);

  const dismissInstallHint = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      setStandalone(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const isIos = useMemo(() => detectIos(), []);

  const showHint = hydrated && !standalone && !dismissed && (Boolean(deferredPrompt) || isIos);

  return {
    isWeb: true,
    isStandalone: standalone,
    canInstall: Boolean(deferredPrompt),
    isIos,
    showHint,
    dismissInstallHint,
    promptInstall,
  };
}
