const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const IMPORT_UPLOAD_BUCKET = 'recipe-import-uploads';
const INLINE_VIDEO_MAX_BYTES = 6 * 1024 * 1024;

export interface ImportImagePayload {
  mimeType: string;
  base64: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export async function downloadUserImportVideo(
  userId: string,
  storagePath: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return null;

  const normalized = storagePath.replace(/^\/+/, '');
  const prefix = `${userId}/`;
  if (!normalized.startsWith(prefix)) return null;

  const objectUrl = `${supabaseUrl}/storage/v1/object/${IMPORT_UPLOAD_BUCKET}/${normalized}`;
  const response = await fetch(objectUrl, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!response.ok) return null;

  const mimeType = (response.headers.get('content-type') ?? 'video/mp4').split(';')[0]!.trim();
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > 104_857_600) return null;
  return { bytes: buffer, mimeType };
}

export async function deleteUserImportVideo(storagePath: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;
  const normalized = storagePath.replace(/^\/+/, '');
  await fetch(`${supabaseUrl}/storage/v1/object/${IMPORT_UPLOAD_BUCKET}/${normalized}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
}

export async function uploadVideoToGeminiFiles(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ fileUri: string; fileName: string } | null> {
  const start = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'recipe-import-video' } }),
    },
  );
  if (!start.ok) return null;
  const uploadTarget = start.headers.get('X-Goog-Upload-URL');
  if (!uploadTarget) return null;

  const upload = await fetch(uploadTarget, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mimeType,
    },
    body: bytes,
  });
  if (!upload.ok) return null;
  const body = (await upload.json()) as { file?: { name?: string; uri?: string } };
  const fileName = body.file?.name;
  const fileUri = body.file?.uri;
  if (!fileName || !fileUri) return null;
  return { fileUri, fileName };
}

export async function deleteGeminiFile(apiKey: string, fileName: string): Promise<void> {
  await fetch(`${GEMINI_API_BASE}/${fileName}?key=${encodeURIComponent(apiKey)}`, {
    method: 'DELETE',
  });
}

export function buildGeminiPartsForVideo(
  bytes: Uint8Array,
  mimeType: string,
  prompt: string,
  fileUri?: string,
): Record<string, unknown>[] {
  if (fileUri) {
    return [{ file_data: { mime_type: mimeType, file_uri: fileUri } }, { text: prompt }];
  }
  return [
    { inline_data: { mime_type: mimeType, data: bytesToBase64(bytes) } },
    { text: prompt },
  ];
}

export function buildGeminiPartsForImages(
  images: ImportImagePayload[],
  prompt: string,
): Record<string, unknown>[] {
  const parts: Record<string, unknown>[] = images.map((img) => ({
    inline_data: { mime_type: img.mimeType, data: img.base64 },
  }));
  parts.push({ text: prompt });
  return parts;
}

export function shouldUseGeminiFileApi(byteLength: number): boolean {
  return byteLength > INLINE_VIDEO_MAX_BYTES;
}
