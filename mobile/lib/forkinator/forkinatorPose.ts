export type ForkinatorMascotPose = 'full' | 'idea' | 'thinking' | 'sad';

export function resolveForkinatorMascotPose(input: {
  thinkingVisible: boolean;
  expirationPromptVisible: boolean;
  aisleSortPromptVisible: boolean;
  scannerPromptVisible: boolean;
  greetingPromptVisible: boolean;
}): ForkinatorMascotPose {
  if (input.thinkingVisible) return 'thinking';
  if (input.expirationPromptVisible) return 'sad';
  if (input.aisleSortPromptVisible) return 'idea';
  if (input.scannerPromptVisible && !input.greetingPromptVisible) return 'idea';
  return 'full';
}
