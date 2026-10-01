import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';
import type { PantryPhotoScanGateInput } from './pantryPhotoScanGate';
import { pantryPhotoScanGateState } from './pantryPhotoScanGate';

export type ResolvedPhotoScanSession = {
  session: Session | null;
  gate: ReturnType<typeof pantryPhotoScanGateState>;
};

/**
 * Prefer React context session; fall back to Supabase persisted session so
 * signed-in users are not treated as guests when context lags behind storage.
 */
export async function resolvePhotoScanSession(
  input: PantryPhotoScanGateInput,
  contextSession: Session | null,
): Promise<ResolvedPhotoScanSession> {
  if (input.demoMode) {
    return { session: contextSession, gate: 'allowed' };
  }

  if (contextSession) {
    return {
      session: contextSession,
      gate: pantryPhotoScanGateState({ ...input, authReady: true, hasSession: true }),
    };
  }

  const client = getSupabase();
  if (!client) {
    return {
      session: null,
      gate: pantryPhotoScanGateState(input),
    };
  }

  const { data } = await client.auth.getSession();
  const persisted = data.session ?? null;
  if (persisted) {
    return {
      session: persisted,
      gate: 'allowed',
    };
  }

  return {
    session: null,
    gate: pantryPhotoScanGateState({
      ...input,
      authReady: input.authReady || true,
      hasSession: false,
    }),
  };
}
