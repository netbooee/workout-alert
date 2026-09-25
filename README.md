# Streaks

An iOS app for working out with friends and family. Workouts sync automatically
from Apple Health, and a **weekly streak** grows every week you hit your goal.

## How streaks work

- You pick a goal of **1–7 workout days per week** (weeks run Monday–Sunday in your timezone).
- A day counts when it has at least one workout of **15+ minutes**. Two workouts on one day still count as one day.
- Hit your goal and the streak grows by one week. The current week never breaks your streak while it's still in progress.
- Every **4 weeks hit** earns a **streak freeze** (max 2). A missed week automatically spends a freeze instead of resetting the streak.
- The first sync looks back 12 weeks, so an existing habit shows up as a streak on day one.

Streaks are computed in Postgres (`supabase/migrations`) whenever workouts change, so
they're consistent across devices and can't be edited by the client.

## Accountability partners

- Everyone has a 6-character **invite code** (Me tab, or Partners → add). Share it as a link
  (`streaks://invite/CODE`) or have your partner type it in. Once they accept, it's mutual.
- Partners see each other's **workouts, streaks, weekly progress, and check-in photos**, and
  nobody else can (enforced by row-level security and storage policies).
- **Check-ins**: workouts from Apple Health show where they came from ("Heart rate from Sam's
  Apple Watch"). Add up to 4 photos and a note to any workout, or **log a workout by hand**
  with photos (the + on Home) for sessions without a watch. Hand-logged workouts without a
  photo are labelled *self-reported*.
- Partners react 🔥 💪 👏 or ✅ **Verify** (you can't verify your own).
- **Nudge** a partner who hasn't hit their week yet (once per 12 hours).
- Long-press a partner card to remove them.

## Push notifications

- **Nudges**: "Alex nudged you 👋 · You're at 2 of 4 days this week. Time to move!"
- **Partner workouts**: "Sam just worked out 🔥 · 42-min run. Tap to cheer or verify ✅"
  (only for workouts that finished in the last day, so the first 12-week sync doesn't spam anyone).
- Tapping opens the relevant screen. Each person can switch either kind off on the Me tab.
- How it works: database triggers write to `notifications` and send to the recipient's
  devices through Expo's push service using `pg_net`. No separate server is needed.

## XP, levels, and the league (Duolingo-style)

| Earn | XP |
| --- | --- |
| Workout (5+ min) | 10 + 1 per 2 min, up to 40 |
| Check-in photo on a workout | +5 |
| Hitting your weekly goal | +50 |

- **Levels** get progressively longer: L2 at 100 XP, L3 at 300, L5 at 1,000, L10 at 4,500.
- **Weekly league**: you and your partners ranked by XP earned this week (Mon–Sun).
- **Friend streak**: with each partner, the number of consecutive weeks you *both* hit
  your goals since becoming partners.
- A **celebration screen** pops up when new XP lands (after a sync, a manual log, or a photo).

## Stack

| Piece | Choice |
| --- | --- |
| App | Expo SDK 57, Expo Router, TypeScript, React Query |
| Health data | [`@kingstinct/react-native-healthkit`](https://github.com/kingstinct/react-native-healthkit) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Auth | Sign in with Apple, Google, or email one-time codes |

## Project layout

```
src/app/                 Screens (Expo Router)
  sign-in.tsx            Apple / Google / email-code sign in
  onboarding.tsx         Weekly goal + Apple Health permission
  (tabs)/index.tsx       Home: streak, week dots, rings, recent workouts
  (tabs)/partners.tsx    League, partner cards, requests, partner activity feed
  (tabs)/me.tsx          Level, stats, 12-week history, goal, invite code, sign out
  workout/[id].tsx       Workout detail: check-in photos, note, reactions
  log.tsx                Log a workout by hand with a check-in photo
  add-partner.tsx        Share your code / enter someone else's
  invite/[code].tsx      Deep link handler for invites
  celebrate.tsx          "+XP" celebration
src/components/          UI pieces
src/lib/health/          HealthKit queries, mapping to rows, sync to Supabase
src/lib/week.ts          Week math shared by the UI
supabase/migrations/     Schema, streak engine, RLS
supabase/tests/          pgTAP tests: streak engine, partners, XP, RLS
```

## Setup

You need a Mac with Xcode, an Apple Developer account (HealthKit and Sign in with
Apple both require one), and a Supabase project.

1. **Install**
   ```sh
   npm install
   cp .env.example .env.local   # fill in your Supabase URL + publishable key
   ```

2. **Database**: link your project and push the schema:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. **Auth** (Supabase dashboard → Authentication):
   - **Sign in with Apple**: enable the Apple provider and add `com.netbooee.streaks`
     (or your own bundle ID from `app.json`) under *Client IDs*. Native sign-in doesn't
     need the secret key.
   - **Google** (optional):
     1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
        OAuth client ID of type **iOS** with bundle ID `com.netbooee.streaks`. Also create a
        **Web application** client if you don't have one; Supabase's form asks for it.
     2. In Supabase, enable the Google provider. Put the web client ID and secret in the form,
        add the **iOS client ID** under *Authorized Client IDs*, and turn on
        **Skip nonce checks** (required for native iOS sign-in).
     3. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `.env.local` and rebuild the dev client
        (`npx expo run:ios`); `app.config.ts` registers the URL scheme from it. Without it the
        Google button is simply hidden.
   - **Email codes**: in *Email Templates*, edit **Magic Link** and **Confirm signup**
     so the body includes `{{ .Token }}` (see `supabase/templates/magic_link.html`).
     The app asks for the 6-digit code rather than handling links.

4. **Push notifications** (optional, but that's how nudges reach people):
   - Run `npx eas-cli@latest init` once and put the printed project ID in `.env.local`
     as `EAS_PROJECT_ID`.
   - Let EAS set up Apple push credentials: `npx eas-cli@latest credentials` (or just run an
     `eas build`, which offers to create them). Push only works on a real iPhone.
   - `pg_net` is enabled by the migration; nothing else to configure in Supabase.

5. **Run on your iPhone.** HealthKit doesn't work in Expo Go, so this needs a development build:
   ```sh
   npx expo run:ios --device
   ```
   or build in the cloud with `npx eas-cli@latest build --profile development --platform ios`.
   The simulator works for UI, but it has no Health data unless you add some in the
   simulator's Health app.

## Checks

```sh
npm run typecheck   # tsc
npm run lint        # expo lint
npm test            # vitest: week math + HealthKit mapping
npm run test:db     # pgTAP: streak engine + RLS (needs `npx supabase start`, Docker)
```

## Roadmap

1. ~~Scaffold, auth, schema~~
2. ~~HealthKit sync (workouts, steps, energy, exercise minutes, heart rate)~~
3. ~~Weekly streak engine + Home screen~~
4. ~~Accountability partners, check-in photos, reactions, nudges~~
5. ~~XP, levels, weekly league, friend streaks, celebrations~~
6. ~~Push notifications for nudges and partner workouts~~
7. More pushes: partner requests, "verified", streak-at-risk reminders
8. Achievements/badges, self-set rewards, challenges
9. Background HealthKit delivery
