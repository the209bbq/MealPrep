import { getSupabase } from '../supabase';
import { RECIPE_IMPORT } from '../../config/recipeImport';

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('webm')) return 'webm';
  return 'jpg';
}

export async function uploadRecipeImportVideo(
  userId: string,
  file: { uri: string; mimeType: string; name: string; size?: number },
): Promise<string> {
  if (file.size != null && file.size > RECIPE_IMPORT.maxVideoBytes) {
    throw new Error('Video is too large (max about 100 MB).');
  }
  const client = getSupabase();
  if (!client) {
    throw new Error('Sign in to upload a video.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || extensionForMime(file.mimeType);
  const path = `${userId}/video-${Date.now()}.${ext}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const { error } = await client.storage.from(RECIPE_IMPORT.uploadBucket).upload(path, blob, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadRecipeImportPhotos(
  userId: string,
  photos: Array<{ uri: string; mimeType: string; base64?: string }>,
): Promise<string[]> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Sign in to upload photos.');
  }
  const paths: string[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index]!;
    const ext = extensionForMime(photo.mimeType);
    const path = `${userId}/photo-${Date.now()}-${index}.${ext}`;
    let blob: Blob;
    if (photo.base64) {
      const binary = atob(photo.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: photo.mimeType });
    } else {
      blob = await (await fetch(photo.uri)).blob();
    }
    const { error } = await client.storage.from(RECIPE_IMPORT.uploadBucket).upload(path, blob, {
      contentType: photo.mimeType,
      upsert: false,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}
