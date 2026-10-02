import { Redirect } from 'expo-router';
import { APP_ROUTES } from '../config/appRoutes';

/** Recipe discovery search lives on the Recipes tab; keep this route as a stable redirect. */
export default function DiscoverRecipesRedirect() {
  return <Redirect href={APP_ROUTES.recipes} />;
}
