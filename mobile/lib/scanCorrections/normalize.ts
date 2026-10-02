/** Compare user-edited names to the original AI label (case/space insensitive). */
export function scanCorrectionNamesDiffer(aiName: string, userName: string): boolean {
  return normalizeScanCorrectionName(aiName) !== normalizeScanCorrectionName(userName);
}

export function normalizeScanCorrectionName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
