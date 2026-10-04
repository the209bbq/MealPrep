/**
 * Parse YouTube-style subscriber display strings (e.g. "4.7M", "892K") to integers.
 */
export function parseSubscriberDisplayString(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const match = trimmed.match(/^([\d,.]+)\s*([KMB])?$/i);
  if (!match) {
    const digits = Number.parseInt(trimmed.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(digits) ? digits : 0;
  }
  const numeric = Number.parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  const suffix = (match[2] ?? '').toUpperCase();
  let multiplier = 1;
  if (suffix === 'K') multiplier = 1_000;
  else if (suffix === 'M') multiplier = 1_000_000;
  else if (suffix === 'B') multiplier = 1_000_000_000;
  return Math.round(numeric * multiplier);
}
