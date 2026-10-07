export type ForkinatorMascotPose = 'full' | 'idea' | 'thinking' | 'sad';

export function resolveForkinatorMascotPose(input: {
  thinkingVisible: boolean;
  expirationPromptVisible: boolean;
  restockPromptVisible: boolean;
  forkInRoadPromptVisible: boolean;
  aisleSortPromptVisible: boolean;
  scannerPromptVisible: boolean;
  greetingPromptVisible: boolean;
}): ForkinatorMascotPose {
  if (input.forkInRoadPromptVisible) return 'thinking';
  if (input.expirationPromptVisible) return 'sad';
  if (input.restockPromptVisible) return 'idea';
  if (input.aisleSortPromptVisible) return 'idea';
  if (input.scannerPromptVisible && !input.greetingPromptVisible) return 'idea';
  if (input.thinkingVisible) return 'thinking';
  return 'full';
}
