// Run with: npx deno test supabase/functions/revoke-apple
import { appleClientSecret, b64url } from './apple.ts';

function assert(ok: boolean, message: string) {
  if (!ok) throw new Error(message);
}

Deno.test('client secret is an ES256 JWT that verifies with the key', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----`;

  const jwt = await appleClientSecret(
    { clientId: 'com.netbooee.sigamos', teamId: 'TEAM123456', keyId: 'KEY1234567', privateKeyPem: pem },
    1_800_000_000,
  );
  const [h, p, s] = jwt.split('.');
  const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));

  assert(decode(h).alg === 'ES256' && decode(h).kid === 'KEY1234567', 'header');
  const payload = decode(p);
  assert(payload.iss === 'TEAM123456' && payload.sub === 'com.netbooee.sigamos', 'issuer and subject');
  assert(payload.aud === 'https://appleid.apple.com' && payload.exp - payload.iat === 300, 'audience and expiry');

  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  assert(sig.length === 64, 'raw r||s signature');
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.publicKey,
    sig,
    new TextEncoder().encode(`${h}.${p}`),
  );
  assert(ok, 'signature verifies');
  assert(b64url('a?b') === 'YT9i', 'base64url');
});
