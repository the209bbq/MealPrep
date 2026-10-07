import { router } from 'expo-router';
import { APP_ROUTES } from '../../config/appRoutes';
import { requestOpenPantryShelfScan } from '../pantry/openShelfScanRequest';

export function openPantryScannerFromForkinator(): void {
  requestOpenPantryShelfScan();
  router.push(APP_ROUTES.pantry);
}
