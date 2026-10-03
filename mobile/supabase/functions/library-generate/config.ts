export const LIBRARY_IMAGE_BUCKET = 'library-recipe-images';

export const DEFAULT_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 3;

export function geminiTextModel(): string {
  return (Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash').trim();
}

export function geminiImageModel(): string {
  return (Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'imagen-3.0-generate-002').trim();
}
