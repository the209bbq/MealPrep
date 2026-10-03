import * as Clipboard from 'expo-clipboard';
import { extractUrlFromSharedText } from './client';

/** User-initiated only — never call on mount or from effects. */
export async function readImportLinkFromClipboard(): Promise<string | null> {
  try {
    const clip = await Clipboard.getStringAsync();
    if (!clip?.trim()) return null;
    return extractUrlFromSharedText(clip) ?? clip.trim();
  } catch {
    return null;
  }
}
