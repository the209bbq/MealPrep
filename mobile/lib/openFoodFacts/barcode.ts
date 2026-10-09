/** Barcode helpers for Open Food Facts lookups (EAN-8, UPC-A, EAN-13, GTIN-14). */

const VALID_LENGTHS = new Set([8, 12, 13, 14]);

/** Keep digits only (scanners and people add spaces/dashes). */
export function normalizeBarcode(input: string): string {
  return input.replace(/\D+/g, '');
}

/** GTIN check digit: weights 3,1,3,1… from the digit left of the check digit. */
export function hasValidGtinCheckDigit(code: string): boolean {
  if (!/^\d+$/.test(code) || !VALID_LENGTHS.has(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits[digits.length - 1];
  let sum = 0;
  for (let i = digits.length - 2, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Returns the barcode to query, or null when it is not a valid GTIN.
 * Open Food Facts stores UPC-A codes as 13 digits with a leading zero, so 12-digit codes are padded.
 */
export function toLookupBarcode(input: string): string | null {
  const digits = normalizeBarcode(input);
  if (!hasValidGtinCheckDigit(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}
