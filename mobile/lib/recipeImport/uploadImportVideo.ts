import { getSupabase } from '../supabase';
import { RECIPE_IMPORT } from '../../config/recipeImport';

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
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `${userId}/import-${Date.now()}.${ext}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const { error } = await client.storage.from(RECIPE_IMPORT.uploadBucket).upload(path, blob, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
