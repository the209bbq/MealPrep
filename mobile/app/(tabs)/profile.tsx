import { Redirect } from 'expo-router';
import { APP_ROUTES } from '../../config/appRoutes';

/** Legacy route — profile lives in the account sheet (avatar in header). */
export default function ProfileRedirectScreen() {
  return <Redirect href={APP_ROUTES.home} />;
}
