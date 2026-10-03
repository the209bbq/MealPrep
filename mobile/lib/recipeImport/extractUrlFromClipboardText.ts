/** First http(s) URL in pasted clipboard text, with trailing punctuation trimmed. */
export function extractUrlFromClipboardText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\]"']+$/, '') : null;
}
