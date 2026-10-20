// Invite links and codes. Kept free of native imports so it stays unit-testable.

export const INVITE_CODE_LENGTH = 6;
const WEB_INVITE_BASE = 'https://sigamos.cloud/invite/';

/** Uppercases and strips anything that can't be in a code; null unless 6 characters remain. */
export function normalizeInviteCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === INVITE_CODE_LENGTH ? code : null;
}

/** The code in sigamos://invite/CODE or https://sigamos.cloud/invite/CODE, or null. */
export function inviteCodeFromUrl(url: string): string | null {
  const match = /^(?:sigamos:\/\/|https:\/\/(?:www\.)?sigamos\.cloud\/)invite\/([^/?#]+)/i.exec(url);
  return match ? normalizeInviteCode(match[1]!) : null;
}

/** The web link to share: it opens the app, or offers the beta if the app isn't installed. */
export function inviteUrl(code: string): string {
  return WEB_INVITE_BASE + code;
}

export function inviteMessage(code: string): string {
  return (
    `Be my workout accountability partner on Sigamos 🔥\n\n` +
    `${inviteUrl(code)}\n` +
    `or enter my code in the app: ${code}`
  );
}
