import { POST_SIGNUP_SETUP_STORAGE_KEY } from '../../config/account';
import { readJson, writeJson } from '../storage';

type DoneMap = Record<string, true>;

function readMap(): DoneMap {
  return readJson<DoneMap>(POST_SIGNUP_SETUP_STORAGE_KEY, {});
}

export function isPostSignupSetupDone(userId: string): boolean {
  if (!userId) return true;
  return readMap()[userId] === true;
}

export function markPostSignupSetupDone(userId: string): void {
  if (!userId) return;
  const map = readMap();
  map[userId] = true;
  writeJson(POST_SIGNUP_SETUP_STORAGE_KEY, map);
  writeJson('mealprep.awaitingProfileSetupEmail', null);
}

const AWAITING_EMAIL_KEY = 'mealprep.awaitingProfileSetupEmail';

export function markAwaitingProfileSetup(email: string): void {
  writeJson(AWAITING_EMAIL_KEY, email.trim().toLowerCase());
}

export function consumeAwaitingProfileSetup(email: string): boolean {
  const awaiting = readJson<string | null>(AWAITING_EMAIL_KEY, null);
  if (!awaiting) return false;
  if (awaiting !== email.trim().toLowerCase()) return false;
  writeJson(AWAITING_EMAIL_KEY, null);
  return true;
}
