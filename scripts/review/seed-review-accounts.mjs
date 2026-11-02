// Sets up the App Review demo accounts so every feature has something to
// show: Riley (the reviewer signs in as Riley) and Sam, partners for about
// five weeks, with workouts, a comment and a cheer, a private group, and a pep
// talk from Sam waiting for Riley. Safe to run again: it resets both accounts'
// demo data each time, so run it right before submitting (the current week
// stays fresh).
//
// Run on your Mac from the project folder (keep the secret key out of chats
// and shell history):
//
//   read -s SUPABASE_SECRET_KEY && export SUPABASE_SECRET_KEY
//   read -s REVIEW_PASSWORD && export REVIEW_PASSWORD
//   node --env-file=.env.local scripts/review/seed-review-accounts.mjs
//
// SUPABASE_SECRET_KEY: Supabase dashboard -> Project Settings -> API Keys ->
// a secret key (sb_secret_...). REVIEW_PASSWORD: the password you'll give
// Apple in App Store Connect (both accounts use it).

import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const password = process.env.REVIEW_PASSWORD;
if (!url || !secret || !password) {
  console.error('Needs EXPO_PUBLIC_SUPABASE_URL (from .env.local), SUPABASE_SECRET_KEY and REVIEW_PASSWORD.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Use a REVIEW_PASSWORD of at least 10 characters.');
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const DAY = 24 * 3600 * 1000;
const now = Date.now();
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function check({ data, error }, what) {
  if (error) {
    console.error(`Failed: ${what}:`, error.message ?? error);
    process.exit(1);
  }
  return data;
}

/** Creates the account, or resets its password if it already exists. */
async function ensureUser(email, fullName) {
  const { users } = check(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'list users');
  const existing = users.find((u) => u.email === email);
  if (existing) {
    check(await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true }), `update ${email}`);
    return existing.id;
  }
  const { user } = check(
    await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
    `create ${email}`,
  );
  return user.id;
}

const riley = await ensureUser('review@sigamos.cloud', 'Riley');
const sam = await ensureUser('sam.review@sigamos.cloud', 'Sam Rivera');
const both = [riley, sam];
console.log('Accounts ready.');

// Profiles: past onboarding, in Cupertino's time zone, 3 days a week.
const onboarded = new Date(now - 40 * DAY).toISOString();
for (const [id, name, mascot] of [
  [riley, 'Riley', 'lotl'],
  [sam, 'Sam Rivera', 'capybara'],
]) {
  check(
    await db
      .from('profiles')
      .update({ display_name: name, mascot, weekly_goal: 3, timezone: 'America/Los_Angeles', onboarded_at: onboarded })
      .eq('id', id),
    `profile ${name}`,
  );
}

// Start clean: workouts (with their comments and cheers), the partnership,
// blocks, Riley's groups and pep talks between them.
check(await db.from('workouts').delete().in('user_id', both), 'clear workouts');
check(
  await db.from('partnerships').delete().or(`requester_id.in.(${both}),addressee_id.in.(${both})`),
  'clear partnerships',
);
check(await db.from('blocks').delete().or(`blocker_id.in.(${both}),blocked_id.in.(${both})`), 'clear blocks');
check(await db.from('groups').delete().eq('created_by', riley), 'clear groups');
const oldTalks = check(await db.from('pep_talks').select('media_path').in('from_id', both), 'old pep talks');
check(await db.from('pep_talks').delete().in('from_id', both), 'clear pep talks');
if (oldTalks.length) await db.storage.from('pep-talks').remove(oldTalks.map((t) => t.media_path));

check(
  await db.from('partnerships').insert({
    requester_id: sam,
    addressee_id: riley,
    status: 'accepted',
    accepted_at: new Date(now - 38 * DAY).toISOString(),
  }),
  'partnership',
);

// Three workouts in each of the last five weeks (Sunday to Saturday, in
// Cupertino time), so both have a 5-week streak. This week: Riley has one so
// far (Home says "2 more workouts"); Sam has one a day, up to three.
const TZ = 'America/Los_Angeles';
const tzOffset = (t) =>
  Date.parse(new Date(t).toLocaleString('en-US', { timeZone: 'UTC' })) -
  Date.parse(new Date(t).toLocaleString('en-US', { timeZone: TZ }));
const offset = tzOffset(now);
const localNow = now - offset; // the wall-clock time in Cupertino, as if it were UTC
const localWeekStart = Math.floor(localNow / DAY) * DAY - new Date(localNow).getUTCDay() * DAY;
const daysIntoWeek = Math.floor((localNow - localWeekStart) / DAY);
/** A moment `weeksAgo` weeks back, on `day` (0 = Sunday) at `hour`, Cupertino time. */
const at = (weeksAgo, day, hour) => localWeekStart - weeksAgo * 7 * DAY + day * DAY + hour * 3600 * 1000 + offset;

const TYPES = ['running', 'traditionalStrengthTraining', 'cycling', 'yoga', 'highIntensityIntervalTraining', 'walking'];
const MINUTES = [45, 30, 50, 35, 60];
function workout(userId, end, i) {
  const minutes = MINUTES[i % MINUTES.length];
  return {
    user_id: userId,
    source: 'manual',
    activity_type: TYPES[i % TYPES.length],
    started_at: new Date(end - minutes * 60 * 1000).toISOString(),
    ended_at: new Date(end).toISOString(),
    duration_s: minutes * 60,
  };
}
const ends = (user) => {
  const days = user === riley ? [1, 3, 5] : [0, 2, 4];
  const hour = user === riley ? 12 : 17;
  const past = [1, 2, 3, 4, 5].flatMap((w) => days.map((d) => at(w, d, hour)));
  const thisWeek =
    user === riley
      ? [at(0, Math.max(daysIntoWeek - 1, 0), 7)]
      : [0, 1, 2].filter((d) => d <= daysIntoWeek).map((d) => at(0, d, 7));
  // Only workouts already over.
  return [...past, ...thisWeek].filter((t) => t < now - 10 * 60 * 1000);
};
const rows = [
  ...ends(riley).map((t, i) => workout(riley, t, i)),
  ...ends(sam).map((t, i) => workout(sam, t, i + 2)),
];
const inserted = check(await db.from('workouts').insert(rows).select('id, user_id, ended_at'), 'workouts');
const latest = (id) =>
  inserted.filter((w) => w.user_id === id).sort((a, b) => b.ended_at.localeCompare(a.ended_at))[0];

// Sam cheers and comments on Riley's latest workout; Riley cheers Sam's.
check(
  await db.from('reactions').insert([
    { workout_id: latest(riley).id, user_id: sam, kind: 'fire' },
    { workout_id: latest(sam).id, user_id: riley, kind: 'strong' },
  ]),
  'cheers',
);
check(
  await db.from('workout_comments').insert({
    workout_id: latest(riley).id,
    user_id: sam,
    body: 'Nice one! Same time Thursday? 💪',
  }),
  'comment',
);
console.log(`Workouts ready (${inserted.length}).`);

// A private group with both of them, Riley as owner.
const code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const group = check(
  await db
    .from('groups')
    .insert({ name: 'Cupertino Crew', emoji: '🏃', invite_code: code, created_by: riley, created_at: new Date(now - 30 * DAY).toISOString() })
    .select()
    .single(),
  'group',
);
const joined = new Date(now - 30 * DAY).toISOString();
check(
  await db.from('group_members').insert([
    { group_id: group.id, user_id: riley, role: 'owner', joined_at: joined },
    { group_id: group.id, user_id: sam, role: 'member', joined_at: joined },
  ]),
  'group members',
);
console.log(`Group ready (code ${code}).`);

// A pep talk from Sam, waiting on Riley's Home screen.
const path = `${sam}/pep-${now}.jpg`;
check(
  await db.storage
    .from('pep-talks')
    .upload(path, readFileSync(new URL('./pep-talk.jpg', import.meta.url)), { contentType: 'image/jpeg' }),
  'pep talk photo',
);
check(
  await db.from('pep_talks').insert({
    from_id: sam,
    to_id: riley,
    media_kind: 'photo',
    media_path: path,
    message: 'You got this, Riley! Two more this week 🔥',
  }),
  'pep talk',
);
console.log('Pep talk ready.');
console.log('Done. Sign in to the app as review@sigamos.cloud with REVIEW_PASSWORD to check.');
