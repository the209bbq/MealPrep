import { isValidUsZip, normalizeUsZipInput } from '../smartShop/usZip';

export const PROFILE_HOME_ZIP_COPY = {
  accessibilityLabel: 'Home ZIP code',
  optionalBlurb: 'Optional — used for nearby stores and Smart Shop.',
  invalidMessage: 'Enter a valid 5-digit US ZIP code, or leave blank.',
  fromLocationHint: 'Filled from your location. You can change it anytime.',
  usingLocationSkip: 'Using your location for store search — add a ZIP anytime in Account.',
} as const;

/** Keep digits only, max 5 (US ZIP). */
export function formatHomeZipInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 5);
}

export type OptionalHomeZipResult =
  | { ok: true; zip: string }
  | { ok: false; message: string };

/** Empty is allowed; non-empty must be a valid 5-digit US ZIP. */
export function validateOptionalHomeZip(value: string): OptionalHomeZipResult {
  const trimmed = normalizeUsZipInput(value);
  if (!trimmed) return { ok: true, zip: '' };
  const five = trimmed.slice(0, 5);
  if (!isValidUsZip(five)) {
    return { ok: false, message: PROFILE_HOME_ZIP_COPY.invalidMessage };
  }
  return { ok: true, zip: five };
}
