import { SUPABASE_URL, isDemoMode } from '../../config/appConfig';
import { ASK_FORKY_COPY, ASK_FORKY_LIMITS } from '../../config/askForky';
import { getSupabase } from '../supabase';
import { buildAskForkyBody, type AskForkyContext, type AskForkyTurn } from './askForkyRequest';

export type { AskForkyContext, AskForkyTurn } from './askForkyRequest';

export interface AskForkyAnswer {
  answer: string;
  recipeIds: string[];
  offTopic: boolean;
  safetyNote: boolean;
  remaining: number | null;
  limit: number | null;
  isPlus: boolean;
}

export class AskForkyError extends Error {
  code: string;
  isPlus: boolean;
  constructor(message: string, code: string, isPlus = false) {
    super(message);
    this.code = code;
    this.isPlus = isPlus;
  }
}

/** Our own wording for each failure; server messages are not shown raw. */
export function askForkyErrorMessage(code: string | undefined, isPlus: boolean): string {
  if (code === 'LIMIT_REACHED') return isPlus ? ASK_FORKY_COPY.limitPlus : ASK_FORKY_COPY.limitFree;
  if (code === 'FEATURE_OFF') return ASK_FORKY_COPY.featureOff;
  if (code === 'NOT_CONFIGURED' || code === 'DEMO_MODE') return ASK_FORKY_COPY.notConfigured;
  if (code === 'UNAUTHENTICATED') return ASK_FORKY_COPY.signInBody;
  if (code === 'TOO_LONG') return ASK_FORKY_COPY.tooLong;
  if (code === 'OFFLINE') return ASK_FORKY_COPY.offline;
  return ASK_FORKY_COPY.genericError;
}

/**
 * Sends one question to our server, which checks sign-in, the allowance and the on/off switch
 * before it asks the AI model. The app never holds an AI key and never talks to the model itself.
 */
export async function askForky(
  question: string,
  history: AskForkyTurn[],
  context: AskForkyContext,
): Promise<AskForkyAnswer> {
  if (question.trim().length > ASK_FORKY_LIMITS.questionChars) {
    throw new AskForkyError(askForkyErrorMessage('TOO_LONG', false), 'TOO_LONG');
  }
  if (isDemoMode()) {
    throw new AskForkyError(askForkyErrorMessage('DEMO_MODE', false), 'DEMO_MODE');
  }
  const client = getSupabase();
  const base = SUPABASE_URL.trim().replace(/\/$/, '');
  if (!client || !base) {
    throw new AskForkyError(askForkyErrorMessage('NOT_CONFIGURED', false), 'NOT_CONFIGURED');
  }
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new AskForkyError(askForkyErrorMessage('UNAUTHENTICATED', false), 'UNAUTHENTICATED');
  }

  let response: Response;
  try {
    response = await fetch(`${base}/functions/v1/ask-forky`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildAskForkyBody(question, history, context)),
    });
  } catch {
    throw new AskForkyError(askForkyErrorMessage('OFFLINE', false), 'OFFLINE');
  }

  const json = (await response.json().catch(() => ({}))) as {
    answer?: unknown;
    recipeIds?: unknown;
    offTopic?: unknown;
    safetyNote?: unknown;
    remaining?: unknown;
    limit?: unknown;
    isPlus?: unknown;
    code?: string;
  };
  const isPlus = json.isPlus === true;
  if (!response.ok || typeof json.answer !== 'string' || !json.answer) {
    const code = json.code ?? 'UPSTREAM_ERROR';
    throw new AskForkyError(askForkyErrorMessage(code, isPlus), code, isPlus);
  }
  return {
    answer: json.answer,
    recipeIds: Array.isArray(json.recipeIds) ? json.recipeIds.filter((id): id is string => typeof id === 'string') : [],
    offTopic: json.offTopic === true,
    safetyNote: json.safetyNote === true,
    remaining: typeof json.remaining === 'number' ? json.remaining : null,
    limit: typeof json.limit === 'number' ? json.limit : null,
    isPlus,
  };
}
