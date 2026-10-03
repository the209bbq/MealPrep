import * as Clipboard from 'expo-clipboard';
import { extractUrlFromClipboardText } from './extractUrlFromClipboardText';

/** User-initiated only — never call on mount or from effects. */
export async function readImportLinkFromClipboard(): Promise<string | null> {
  try {
    const clip = await Clipboard.getStringAsync();
    if (!clip?.trim()) return null;
    return extractUrlFromClipboardText(clip) ?? clip.trim();
  } catch {
    return null;
  }
}
