export type ForkinatorMascotTapAction =
  | 'dismissGreetingPrompt'
  | 'dismissExpirationPrompt'
  | 'dismissRestockPrompt'
  | 'dismissForkInRoadPrompt'
  | 'dismissAisleSortPrompt'
  | 'dismissScannerPrompt'
  /** No prompt visible: tapping Forky does nothing (thinking bubble removed). */
  | 'none';

export function resolveForkinatorMascotTapAction(input: {
  greetingPromptVisible: boolean;
  expirationPromptVisible: boolean;
  restockPromptVisible: boolean;
  forkInRoadPromptVisible: boolean;
  aisleSortPromptVisible: boolean;
  scannerPromptVisible: boolean;
}): ForkinatorMascotTapAction {
  if (input.greetingPromptVisible) return 'dismissGreetingPrompt';
  if (input.expirationPromptVisible) return 'dismissExpirationPrompt';
  if (input.restockPromptVisible) return 'dismissRestockPrompt';
  if (input.forkInRoadPromptVisible) return 'dismissForkInRoadPrompt';
  if (input.aisleSortPromptVisible) return 'dismissAisleSortPrompt';
  if (input.scannerPromptVisible) return 'dismissScannerPrompt';
  return 'none';
}
