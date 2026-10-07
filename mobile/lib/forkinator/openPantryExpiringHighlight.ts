import { router } from 'expo-router';
import { APP_ROUTES } from '../../config/appRoutes';
import { requestPantryExpiringHighlight } from '../pantry/openExpiringHighlightRequest';

export function openPantryExpiringHighlightFromForkinator(itemIds: readonly string[]): void {
  requestPantryExpiringHighlight(itemIds);
  router.push(APP_ROUTES.pantry);
}
