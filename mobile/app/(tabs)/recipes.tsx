import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy deep links to /recipes land on Home (recipe discovery feed). */
export default function RecipesLegacyRedirect() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }
  const hasParams = Object.keys(flat).length > 0;
  if (hasParams) {
    return <Redirect href={{ pathname: '/', params: flat }} />;
  }
  return <Redirect href="/" />;
}
