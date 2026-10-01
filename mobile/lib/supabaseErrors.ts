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
  return `Database is missing a column or table. Run ${sqlFile} in the Supabase SQL editor, then reload the app.`;
}

export function formatSupabaseError(error: unknown, sqlFile?: string): string {
  if (isPostgrestError(error)) {
    const hint = sqlFile ? migrationHintForError(error, sqlFile) : null;
    if (hint) return hint;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong saving to Supabase.';
}
