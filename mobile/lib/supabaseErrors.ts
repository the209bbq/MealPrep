import type { PostgrestError } from '@supabase/supabase-js';

const MISSING_SCHEMA_CODES = new Set(['PGRST204', 'PGRST205']);

export function isPostgrestError(error: unknown): error is PostgrestError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

export function isMissingSchemaError(error: unknown): boolean {
  if (!isPostgrestError(error)) return false;
  return MISSING_SCHEMA_CODES.has(error.code);
}

export function migrationHintForError(
  error: unknown,
  sqlFile: string,
): string | null {
  if (!isMissingSchemaError(error)) return null;
  console.warn(
    `[mealprep] Database schema may be out of date. An admin can apply the migration file: ${sqlFile}`,
    error,
  );
  return 'Your account data isn’t fully set up yet. Ask an admin to finish setup, then reload the app.';
}

export function formatSupabaseError(error: unknown, sqlFile?: string): string {
  if (isPostgrestError(error)) {
    const hint = sqlFile ? migrationHintForError(error, sqlFile) : null;
    if (hint) return hint;
    console.warn('[mealprep] save failed:', error);
    return 'Something went wrong while saving. Try again in a moment.';
  }
  if (error instanceof Error) {
    console.warn('[mealprep] save failed:', error);
    return error.message;
  }
  return 'Something went wrong while saving. Try again in a moment.';
}
