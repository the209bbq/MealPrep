import { Linking } from 'react-native';

/** Open an external URL in the system browser (works on native and web). */
export async function openExternalUrl(url: string): Promise<void> {
  const can = await Linking.canOpenURL(url);
  if (!can) throw new Error('Cannot open this link on your device.');
  await Linking.openURL(url);
}
