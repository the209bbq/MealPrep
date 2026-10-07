import { router } from 'expo-router';
import { APP_ROUTES } from '../../config/appRoutes';
import { requestOpenPantryShelfScan } from '../pantry/openShelfScanRequest';

export function openPantryScannerFromForkinator(): void {
  requestOpenPantryShelfScan('menu');
  router.push(APP_ROUTES.pantry);
}

export function openPantryCameraScanFromForkinator(): void {
  requestOpenPantryShelfScan('camera');
  router.push(APP_ROUTES.pantry);
}
