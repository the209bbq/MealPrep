import { PANTRY_SCAN_UI_COPY } from '../../config/pantryScan';

export type ScanCardVariant = 'shelf' | 'receipt';

/**
 * Title, subtitle, label and icon for each kind of scan card.
 * Lives outside the button component on purpose: the web and native button files share one
 * import path, so a value imported from that path on web would resolve to the importing file.
 */
export function scanCardContent(variant: ScanCardVariant = 'shelf') {
  return variant === 'receipt'
    ? {
        title: PANTRY_SCAN_UI_COPY.receiptCardTitle,
        subtitle: PANTRY_SCAN_UI_COPY.receiptCardSubtitle,
        a11y: PANTRY_SCAN_UI_COPY.scanReceiptA11y,
        icon: 'receipt-outline' as const,
      }
    : {
        title: PANTRY_SCAN_UI_COPY.scanCardTitle,
        subtitle: PANTRY_SCAN_UI_COPY.scanCardSubtitle,
        a11y: PANTRY_SCAN_UI_COPY.scanShelfA11y,
        icon: 'camera-outline' as const,
      };
}
