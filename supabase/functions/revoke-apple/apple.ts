// Sign in with Apple helpers, kept apart from the server so they can be tested.

export const APPLE = 'https://appleid.apple.com';

export interface AppleKey {
  clientId: string;
  teamId: string;
  keyId: string;
  /** Contents of the .p8 file (PKCS#8 PEM). */
  privateKeyPem: string;
}

/** The ES256 JWT Apple wants as client_secret, valid for five minutes. */
export async function appleClientSecret(k: AppleKey, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const der = Uint8Array.from(
    atob(k.privateKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const header = { alg: 'ES256', kid: k.keyId };
  const payload = { iss: k.teamId, iat: now, exp: now + 300, aud: APPLE, sub: k.clientId };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // WebCrypto's ECDSA signature is already the raw r||s form JWT expects.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(signature))}`;
}

export function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
