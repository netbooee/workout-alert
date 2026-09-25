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

## Stack

| Piece | Choice |
| --- | --- |
| App | Expo SDK 57, Expo Router, TypeScript, React Query |
| Health data | [`@kingstinct/react-native-healthkit`](https://github.com/kingstinct/react-native-healthkit) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Auth | Sign in with Apple, plus email one-time codes |

## Project layout

```
src/app/                 Screens (Expo Router)
  sign-in.tsx            Apple / email-code sign in
  onboarding.tsx         Weekly goal + Apple Health permission
  (tabs)/index.tsx       Home: streak, week dots, rings, recent workouts
  (tabs)/me.tsx          Stats, 12-week history, goal, re-sync, sign out
src/components/          UI pieces
src/lib/health/          HealthKit queries, mapping to rows, sync to Supabase
src/lib/week.ts          Week math shared by the UI
supabase/migrations/     Schema, streak engine, RLS
supabase/tests/          pgTAP tests for the streak engine and RLS
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
   - **Email codes**: in *Email Templates*, edit **Magic Link** and **Confirm signup**
     so the body includes `{{ .Token }}` (see `supabase/templates/magic_link.html`).
     The app asks for the 6-digit code rather than handling links.

4. **Run on your iPhone.** HealthKit doesn't work in Expo Go, so this needs a development build:
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
4. Crews: invite links, shared feed, reactions, nudges, crew streak, push notifications
5. Badges, XP, self-set rewards
6. Challenges, leaderboards, background HealthKit delivery
