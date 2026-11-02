// Accounts for Apple's App Review (and for demoing the app). They sign in with
// a password instead of an emailed code, since a reviewer can't read the
// code's inbox. Only these addresses get the password field; everyone else
// still signs in with a code. The password lives in Supabase, never in code
// (scripts/review/seed-review-accounts.mjs sets it). No native imports.

export const REVIEW_EMAILS = ['review@sigamos.cloud', 'sam.review@sigamos.cloud'] as const;

export function isReviewEmail(email: string): boolean {
  return (REVIEW_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}
