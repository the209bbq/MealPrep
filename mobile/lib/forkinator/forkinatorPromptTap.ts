export type ForkinatorMascotTapAction =
  | 'dismissGreetingPrompt'
  | 'dismissExpirationPrompt'
  | 'dismissAisleSortPrompt'
  | 'dismissScannerPrompt'
  | 'toggleThinkingBubble';

export function resolveForkinatorMascotTapAction(input: {
  greetingPromptVisible: boolean;
  expirationPromptVisible: boolean;
  aisleSortPromptVisible: boolean;
  scannerPromptVisible: boolean;
}): ForkinatorMascotTapAction {
  if (input.greetingPromptVisible) return 'dismissGreetingPrompt';
  if (input.expirationPromptVisible) return 'dismissExpirationPrompt';
  if (input.aisleSortPromptVisible) return 'dismissAisleSortPrompt';
  if (input.scannerPromptVisible) return 'dismissScannerPrompt';
  return 'toggleThinkingBubble';
}
