/** Native stub — install prompts are web-only. */
export function usePwaInstall() {
  return {
    isWeb: false,
    isStandalone: false,
    canInstall: false,
    isIos: false,
    showHint: false,
    dismissInstallHint: () => {},
    promptInstall: async () => false,
  };
}
