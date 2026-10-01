import type { Session } from '@supabase/supabase-js';
import {
  photoScanAccessState,
  type PhotoScanAccessInput,
  type PhotoScanAccessState,
} from '../plans/photoScanAccess';
import { resolvePhotoScanSession } from './resolvePhotoScanSession';

export type ResolvedPhotoScanAccess = {
  session: Session | null;
  access: PhotoScanAccessState;
};

/**
 * Resolve sign-in session (including persisted Supabase session) then apply Plus plan gate.
 */
export async function resolvePhotoScanAccess(
  input: PhotoScanAccessInput,
  contextSession: Session | null,
): Promise<ResolvedPhotoScanAccess> {
  const resolved = await resolvePhotoScanSession(
    {
      demoMode: input.demoMode,
      authReady: input.authReady,
      hasSession: input.hasSession,
    },
    contextSession,
  );

  if (resolved.gate === 'auth_loading') {
    return { session: resolved.session, access: 'auth_loading' };
  }
  if (resolved.gate === 'guest_blocked') {
    return { session: resolved.session, access: 'guest_blocked' };
  }

  const access = photoScanAccessState({
    ...input,
    authReady: true,
    hasSession: true,
  });

  return { session: resolved.session, access };
}
