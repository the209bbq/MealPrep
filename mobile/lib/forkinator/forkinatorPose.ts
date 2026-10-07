export type ForkinatorMascotPose = 'full' | 'idea' | 'thinking';

export function resolveForkinatorMascotPose(input: {
  thinkingVisible: boolean;
  scannerPromptVisible: boolean;
  greetingPromptVisible: boolean;
}): ForkinatorMascotPose {
  if (input.thinkingVisible) return 'thinking';
  if (input.scannerPromptVisible && !input.greetingPromptVisible) return 'idea';
  return 'full';
}
