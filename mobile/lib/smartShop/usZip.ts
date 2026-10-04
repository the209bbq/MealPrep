export function isValidUsZip(zip: unknown): boolean {
  if (typeof zip !== 'string') return false;
  const trimmed = zip.trim();
  if (!trimmed) return false;
  return /^\d{5}(-\d{4})?$/.test(trimmed);
}

export function normalizeUsZipInput(zip: unknown): string {
  if (typeof zip !== 'string') return '';
  return zip.trim();
}
