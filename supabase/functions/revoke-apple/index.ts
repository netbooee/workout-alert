// Revokes Sign in with Apple for someone deleting their account, as App Store
// Review Guideline 5.1.1(v) requires. The app asks Apple for a fresh
// authorization code, sends it here, and we trade it for a token and revoke
// that, so nothing about Apple accounts is ever stored.
//
// Secrets (npx supabase secrets set ...):
//   APPLE_TEAM_ID     10-character Team ID
//   APPLE_KEY_ID      Key ID of a key with Sign in with Apple enabled
//   APPLE_PRIVATE_KEY contents of that key's .p8 file
//   APPLE_CLIENT_ID   the app's bundle ID (com.netbooee.sigamos)
//
// Supabase checks the caller's sign-in token before this runs (verify_jwt).

import { APPLE, appleClientSecret } from './apple.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== 'string' || !code) return Response.json({ error: 'Missing code' }, { status: 400 });

  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  if (!clientId) return Response.json({ error: 'Apple sign-in revocation is not configured' }, { status: 500 });

  const clientSecret = await appleClientSecret({
    clientId,
    teamId: Deno.env.get('APPLE_TEAM_ID') ?? '',
    keyId: Deno.env.get('APPLE_KEY_ID') ?? '',
    privateKeyPem: Deno.env.get('APPLE_PRIVATE_KEY') ?? '',
  });
  const form = (fields: Record<string, string>) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
  });

  const tokenRes = await fetch(`${APPLE}/auth/token`, form({ code, grant_type: 'authorization_code' }));
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    return Response.json({ error: 'Apple rejected the code', detail: tokens.error }, { status: 400 });
  }

  const token = tokens.refresh_token ?? tokens.access_token;
  const revokeRes = await fetch(
    `${APPLE}/auth/revoke`,
    form({ token, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token' }),
  );
  if (!revokeRes.ok) return Response.json({ error: 'Apple did not revoke the token' }, { status: 502 });
  return Response.json({ revoked: true });
});
