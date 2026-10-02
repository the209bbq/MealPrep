import { AVATARS, buildAvatarObjectPath } from '../../config/avatars';
import { SUPABASE_URL, isDemoMode } from '../../config/appConfig';
import { getSupabase } from '../supabase';
import type { PreparedAvatarImage } from './types';

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type AvatarUploadResult = {
  photoUrl: string;
  storagePath: string;
};

export async function uploadAvatarImage(
  prepared: PreparedAvatarImage,
  userId: string,
): Promise<AvatarUploadResult> {
  if (isDemoMode()) {
    return { photoUrl: prepared.uri, storagePath: 'demo' };
  }

  const client = getSupabase();
  if (!client || !userId) throw new Error('Sign in to upload a profile photo.');

  const storagePath = buildAvatarObjectPath(userId);
  const body = base64ToUint8Array(prepared.base64);
  const { error: uploadError } = await client.storage.from(AVATARS.bucketId).upload(storagePath, body, {
    contentType: prepared.mimeType,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const base = SUPABASE_URL.trim().replace(/\/$/, '');
  const photoUrl = `${base}/storage/v1/object/public/${AVATARS.bucketId}/${storagePath}`;

  const { error: profileError } = await client
    .from('profiles')
    .update({ photo_url: photoUrl, avatar_path: storagePath })
    .eq('id', userId);
  if (profileError) throw profileError;

  return { photoUrl, storagePath };
}

export async function clearAvatarPhoto(userId: string): Promise<void> {
  if (isDemoMode()) return;
  const client = getSupabase();
  if (!client || !userId) return;

  const { data: row } = await client.from('profiles').select('avatar_path').eq('id', userId).maybeSingle();
  const path = (row as { avatar_path?: string | null } | null)?.avatar_path;
  if (path?.trim()) {
    await client.storage.from(AVATARS.bucketId).remove([path]);
  }

  await client.from('profiles').update({ photo_url: null, avatar_path: null }).eq('id', userId);
}
