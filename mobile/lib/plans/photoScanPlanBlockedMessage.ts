import { PLANS_COPY } from '../../config/plans';
import { shouldShowUpgradeOffer } from '../platform/shouldShowUpgradeOffer';

export function photoScanPlanBlockedMessage(): { title: string; message: string } {
  if (!shouldShowUpgradeOffer()) {
    return {
      title: 'Photo scan unavailable',
      message:
        'Shelf photo scanning is not available in this version of the app yet. You can still add pantry items manually.',
    };
  }
  return {
    title: PLANS_COPY.photoScanUpgradeTitle,
    message: PLANS_COPY.photoScanUpgradeBody,
  };
}
