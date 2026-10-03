import { LIBRARY_IMAGE_BUCKET } from './config.ts';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type ImageGenResult = {
  bytes: Uint8Array;
  contentType: string;
  publicUrl: string;
} | null;

function classifyQuota(status: number, body: string): 'rate_limit' | 'quota_exhausted' | 'none' {
  if (status === 429) return 'rate_limit';
  if (/RESOURCE_EXHAUSTED|quota/i.test(body)) return 'quota_exhausted';
  return 'none';
}

async function generateWithImagenPredict(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ bytes: Uint8Array; contentType: string } | { error: string; quota: 'rate_limit' | 'quota_exhausted' | 'none' }> {
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:predict?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '4:3' },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    return { error: text.slice(0, 400), quota: classifyQuota(response.status, text) };
  }
  const json = JSON.parse(text) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) return { error: 'No image bytes', quota: 'none' };
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const contentType = json.predictions?.[0]?.mimeType?.includes('png') ? 'image/png' : 'image/jpeg';
  return { bytes, contentType };
}

async function resizeToWebMax(bytes: Uint8Array, contentType: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  try {
    const { Image } = await import('https://deno.land/x/imagescript@1.3.0/mod.ts');
    const image = await Image.decode(bytes);
    const maxWidth = 800;
    if (image.width > maxWidth) {
      const scaled = image.resize(maxWidth, Image.RESIZE_AUTO);
      const out = await scaled.encodeJPEG(82);
      return { bytes: out, contentType: 'image/jpeg' };
    }
    if (contentType === 'image/png') {
      const out = await image.encodeJPEG(82);
      return { bytes: out, contentType: 'image/jpeg' };
    }
    return { bytes, contentType };
  } catch {
    return { bytes, contentType };
  }
}

export async function generateAndStoreRecipeImage(options: {
  apiKey: string;
  imageModel: string;
  supabaseUrl: string;
  serviceKey: string;
  slug: string;
  title: string;
}): Promise<{ result: ImageGenResult; quota: 'rate_limit' | 'quota_exhausted' | 'none' }> {
  const prompt =
    `Professional food photography of ${options.title}. Appetizing, realistic plated home-cooked dinner on a simple table. ` +
    'Soft natural light, shallow depth of field. No people, no hands, no logos, no text, no brands.';

  const generated = await generateWithImagenPredict(options.apiKey, options.imageModel, prompt);
  if ('error' in generated) {
    console.warn('library-generate image failed', generated.error);
    return { result: null, quota: generated.quota };
  }

  const resized = await resizeToWebMax(generated.bytes, generated.contentType);
  const ext = resized.contentType === 'image/webp' ? 'webp' : 'jpeg';
  const path = `${options.slug}.${ext}`;
  const uploadUrl = `${options.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${LIBRARY_IMAGE_BUCKET}/${path}`;

  const upload = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.serviceKey}`,
      apikey: options.serviceKey,
      'Content-Type': resized.contentType,
      'x-upsert': 'true',
    },
    body: resized.bytes,
  });

  if (!upload.ok) {
    console.warn('library-generate image upload failed', await upload.text());
    return { result: null, quota: 'none' };
  }

  const publicUrl = `${options.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${LIBRARY_IMAGE_BUCKET}/${path}`;
  return {
    result: { bytes: resized.bytes, contentType: resized.contentType, publicUrl },
    quota: 'none',
  };
}
