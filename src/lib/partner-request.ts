// What to tell someone after they use an invite code or link. request_partner
// returns the existing partnership when there already is one, so tell people
// apart by its age. No native imports.

import type { Database } from './database.types';

type Partnership = Pick<
  Database['public']['Tables']['partnerships']['Row'],
  'status' | 'requester_id' | 'created_at' | 'accepted_at'
>;

/** Anything older than this already existed before this request. */
const FRESH_MS = 60_000;

export function requestOutcome(p: Partnership, me: string, now: Date = new Date()): { title: string; body: string } {
  const old = (iso: string | null) => !!iso && now.getTime() - new Date(iso).getTime() > FRESH_MS;
  if (p.status === 'accepted') {
    return old(p.accepted_at)
      ? { title: 'You’re already partners 🤝', body: 'You can find them on your Partners tab.' }
      : { title: 'You’re partners! 🤝', body: 'You can now see each other’s workouts and streaks.' };
  }
  if (p.requester_id === me && old(p.created_at)) {
    return {
      title: 'Request already sent',
      body: 'Still waiting for them to accept. You can cancel it on your Partners tab.',
    };
  }
  return { title: 'Request sent', body: 'They’ll show up in your partners once they accept.' };
}
