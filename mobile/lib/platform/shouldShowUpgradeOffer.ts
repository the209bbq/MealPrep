import { Platform } from 'react-native';
import { UPGRADE_OFFER_CONFIG } from '../../config/upgradeOffer';

/** Web and iOS keep upgrade copy; Android follows {@link UPGRADE_OFFER_CONFIG.androidVisible}. */
export function shouldShowUpgradeOffer(): boolean {
  if (Platform.OS === 'android' && !UPGRADE_OFFER_CONFIG.androidVisible) return false;
  return true;
}
