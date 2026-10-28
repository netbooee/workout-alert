// Turns whatever was thrown (an Error, a Supabase/PostgREST error object, a
// string) into a sentence people can act on. No native imports.

const OFFLINE = 'You seem to be offline. Check your connection and try again.';
const SIGNED_OUT = 'Your sign-in has expired. Sign out and sign back in, then try again.';
const GENERIC = 'Something went wrong on our side. Please try again in a moment.';

/** Codes our own database functions raise with messages written for people. */
const READABLE_CODES = new Set(['P0001', 'P0002', '22023', '23514']);

/** Bits of database or network jargon that should never reach the screen. */
const TECHNICAL = /violates|relation |column |function |syntax|permission denied|null value|PGRST|JWT|schema|constraint|uuid|undefined|\[object/i;

export function friendlyError(e: unknown): string {
  const err = (typeof e === 'object' && e !== null ? e : { message: String(e) }) as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
  };
  const message = typeof err.message === 'string' ? err.message.trim() : '';
  const code = typeof err.code === 'string' ? err.code : '';

  if (/network request failed|failed to fetch|internet connection|offline|timed out|network error/i.test(message)) {
    return OFFLINE;
  }
  if (code === '57014') return 'That took too long. Please try again.';
  if (/jwt expired|invalid jwt|not authenticated|refresh token/i.test(message) || err.status === 401) {
    return SIGNED_OUT;
  }
  if (code === '23505') return 'That’s already been done.';
  if (code === 'PGRST116') return 'We couldn’t find that. It may have been removed.';
  // Our functions raise 42501 when there's no signed-in user; Postgres uses it for denied access.
  if (code === '42501') return /permission denied/i.test(message) ? GENERIC : SIGNED_OUT;
  if (READABLE_CODES.has(code) && message) return message;
  if (!message || TECHNICAL.test(message)) return GENERIC;
  return message;
}
