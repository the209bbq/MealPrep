import { normalizeImportUrl } from './urlClassificationClient';

function extractUrlFromSharedText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\]"']+$/, '') : null;
}

export type ParsedImportInput =
  | { kind: 'url'; url: string; caption?: string }
  | { kind: 'text'; text: string };

export const MIN_TEXT_IMPORT_CHARS = 24;

function stripUrlFromText(full: string, url: string): string {
  return full.replace(url, '').replace(/\s+/g, ' ').trim();
}

/** Classify pasted/typed import content (link, link+caption, or raw recipe text). */
export function parseImportInput(raw: string): ParsedImportInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const embedded = extractUrlFromSharedText(trimmed);
  if (embedded) {
    const normalized = normalizeImportUrl(embedded);
    if (normalized) {
      const caption = stripUrlFromText(trimmed, embedded);
      if (caption.length > 0) {
        return { kind: 'url', url: normalized, caption };
      }
      return { kind: 'url', url: normalized };
    }
  }

  const directUrl = normalizeImportUrl(trimmed);
  if (directUrl) {
    return { kind: 'url', url: directUrl };
  }

  if (trimmed.length >= MIN_TEXT_IMPORT_CHARS) {
    return { kind: 'text', text: trimmed };
  }

  return null;
}
