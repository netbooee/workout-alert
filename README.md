# Sigamos

*Spanish for "let's keep going."*

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
  (`sigamos://invite/CODE`) or have your partner type it in. Once they accept, it's mutual.
- Partners see each other's **workouts, streaks, weekly progress, and check-in photos**, and
  nobody else can (enforced by row-level security and storage policies).
- **Check-ins**: workouts from Apple Health show where they came from ("Heart rate from Sam's
  Apple Watch"). Add up to 4 photos and a note to any workout, or **log a workout by hand**
  with photos (the + on Home) for sessions without a watch. Hand-logged workouts without a
  photo are labelled *self-reported*.
- Partners react 🔥 💪 👏 or ✅ **Verify** (you can't verify your own).
- **Delete** a hand-logged workout from its detail screen (its photos, reactions, and XP go
  with it). Apple Health workouts are deleted in the Health app and disappear on the next sync.
- **Comments and voice messages** on any workout you can see: type encouragement or tap the mic
  for a voice note (up to 30 seconds, recorded in the app). You see comments from yourself and
  your partners; the workout owner sees them all and can reply. Long-press a comment to delete
  it (your own, or any on your workout).
- **Nudge** a partner who hasn't hit their week yet (once per 12 hours).
- Long-press a partner card to remove them.

## Progress

The Me tab has a **Progress** chart: weekly active minutes or workout count for the last
12 weeks, 6 months, or year, with a dashed line for your weekly average (counted from your
first active week, current week excluded). Tap a bar to see that week's totals, streak
status, and workouts by day. The math is in `src/lib/progress.ts` (unit-tested).

## Incentives

A partner can reward you for extra effort: **"Hit 5 workout days this week → ☕ Coffee on me"**.

- **Offer** from a partner's card (🎁 Offer an incentive), a partner's workout, or the intro card
  on the Partners tab. Goals: workout days, active minutes, a number of workouts (optionally one
  type, e.g. 3 runs), or reaching a streak length; over 1, 2, or 4 weeks counted from this Monday
  in the recipient's timezone. Rewards are real-world text (no money in the app).
- **Verified only** (off by default) counts only Apple Health workouts or ones a partner verified.
- The recipient accepts or passes. Progress updates automatically from workouts (computed in
  Postgres). Hitting the goal earns it: **+100 XP**, a celebration, and pushes to both people.
  The giver marks it **delivered**; it lands on the recipient's **reward shelf** (Me tab).
- One open incentive per giver → recipient. Unmet ones expire at the deadline (hourly sweep) with
  a gentle message; no shaming.
- Logic: `supabase/migrations/20261003000000_incentives.sql` (pgTAP in
  `supabase/tests/incentives.test.sql`); wording mirrored in `src/lib/incentives.ts`.

## Lotl, the streak mascot

- A pink axolotl whose face, color, and gills reflect how your week is going (gills
  flare up when things are good, droop when they're not): **blazing** (goal hit),
  **happy** (on track), **ready** (fresh week), **worried** (streak at risk), **fired up**
  (4+ idle days, or the week is lost with no freeze), and **sleepy** (rest mode).
- The first time you open the app each day, Lotl greets you full-screen with one headline,
  up to three facts (streak, nudges, verifications, partners, league) and one action.
  After that it lives in the Home header; tap it to see the greeting again.
- Playful, never shaming: never angry when a freeze covers the week, and "fired up" only on
  the daily greeting (the header calms down to worried).
- Mood rules and copy live in `src/lib/lotl.ts` (unit-tested); the drawing is
  `src/components/lotl.tsx`. The mood → color/scale table is shared so a widget can match.

## Rest mode

Sick, injured, or traveling? Turn on Rest mode (Me tab). Weeks you don't hit are marked
*rest*: they don't break your streak, don't spend a freeze, and hold friend streaks. Streak
reminders pause. Workouts during rest still count.

## Appearance

Light, dark, or **Automatic** (follows the iPhone), set on the Me tab. Theme colors in
`src/constants/theme.ts` are iOS dynamic colors with a light and dark value each, so static
styles re-color instantly; React Navigation gets plain hex values via `Palettes`.

## Push notifications

- **Nudges**: "Alex nudged you 👋 · You're at 2 of 4 days this week. Time to move!"
- **Partner workouts**: "Sam just worked out 🔥 · 42-min run. Tap to cheer or verify ✅"
  (only for workouts that finished in the last day, so the first 12-week sync doesn't spam anyone).
- **Partner requests**: "Blair wants to be your accountability partner 🤝", and when it's
  accepted, "Alex accepted your partner request 🤝".
- **Verified**: "Blair verified your run ✅ · Your 42-min run is verified. Nice work!"
  (once per partner per workout, even if they toggle Verify off and on).
- **Streak at risk**: at 6pm local time, if your streak needs a workout on (almost) every
  remaining day this week: "Your 2-week streak is on the line 🔥 · You need a workout every day
  left this week: 3 to go." On Sunday: "Last chance to keep your 5-week streak 🔥". At most once a
  day, only if you have a streak, and never once the week is already out of reach.
- **Comments**: "Sam commented on your run 💬 · “Hill repeats on a Friday?!”" or "Sam sent you
  a voice message 🎙️". Replies notify the people already in the conversation.
- **Incentives**: "Sam offered you an incentive 🎁 · Hit 5 workout days this week → ☕ Coffee on
  me", accepted, earned ("You earned Sam's incentive! 🎉"), delivered, or ended.
- Tapping opens the relevant screen. Each kind can be switched off on the Me tab.
- How it works: database triggers write to `notifications` and send to the recipient's
  devices through Expo's push service using `pg_net`. No separate server is needed.

## XP, levels, and the league (Duolingo-style)

| Earn | XP |
| --- | --- |
| Workout (5+ min) | 10 + 1 per 2 min, up to 40 |
| Check-in photo on a workout | +5 |
| Hitting your weekly goal | +50 |
| Earning a partner's incentive | +100 |

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
  (tabs)/index.tsx       Home: streak + week dots, rings, 8-week trend, recent workouts
  (tabs)/partners.tsx    League, partner cards, requests, partner activity feed
  (tabs)/me.tsx          Level, stats, 12-week history, progress chart, goal, invite code
  week/[start].tsx       One week from the progress chart: totals and workouts by day
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
   - **Sign in with Apple**: enable the Apple provider and add `com.netbooee.sigamos`
     (or your own bundle ID from `app.json`) under *Client IDs*. Native sign-in doesn't
     need the secret key.
   - **Google** (optional):
     1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
        OAuth client ID of type **iOS** with bundle ID `com.netbooee.sigamos`. Also create a
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
   - **Email sending** goes through [Resend](https://resend.com) over SMTP so sign-in codes
     aren't capped at Supabase's built-in 2/hour. Sender: `Sigamos <noreply@mail.sigamos.cloud>`
     (domain `mail.sigamos.cloud`, DNS at Hover). Supabase → Authentication → Emails → SMTP:
     host `smtp.resend.com`, port 465, user `resend`, password = a Resend API key with sending
     access. Auth rate limit for emails raised to 30/hour.

4. **Push notifications** (optional, but that's how nudges reach people):
   - The EAS project ID is in `app.json` (`extra.eas.projectId`). For your own fork, run
     `npx eas-cli@latest init` and replace it (or set `EAS_PROJECT_ID` in `.env.local`).
   - Let EAS set up Apple push credentials: `npx eas-cli@latest credentials` (or just run an
     `eas build`, which offers to create them). Push only works on a real iPhone.
   - `pg_net` and `pg_cron` are enabled by the migrations (the hourly reminder job is scheduled
     automatically); nothing else to configure in Supabase.

5. **Run on your iPhone.** HealthKit doesn't work in Expo Go, so this needs a development build:
   ```sh
   npx expo run:ios --device
   ```
   or build in the cloud with `npx eas-cli@latest build --profile development --platform ios`.
   The simulator works for UI, but it has no Health data unless you add some in the
   simulator's Health app.

6. **TestFlight**: a production build with the JavaScript bundled in (no Mac needed to run it).
   `eas.json` carries the Supabase URL and publishable key for cloud builds, since `.env.local`
   isn't uploaded.
   ```sh
   npx eas-cli@latest build --platform ios --profile production --auto-submit
   ```
   EAS creates the signing certificate, provisioning profile, and App Store Connect record,
   then uploads the build to TestFlight.

## Website

`website/` is the static site for **sigamos.cloud** (marketing page, `/privacy`, `/terms`,
`/support`, and `/invite/<CODE>` fallback for invite links), deployed by Netlify from this repo
(`netlify.toml`, no build step). Keep DNS at Hover so the Resend email records keep working: point
`@` (A record) and `www` (CNAME) at Netlify. The TestFlight link is a placeholder
(`REPLACE_ME`) in `website/index.html` and `website/invite/index.html`. Screenshots in
`website/img/` come from the web preview; swap in real device screenshots when you have them.

## Checks

```sh
npm run typecheck   # tsc
npm run lint        # expo lint
npm test            # vitest: week math + HealthKit mapping
npm run test:db     # pgTAP: streak engine + RLS (needs `npx supabase start`, Docker)
```

## Roadmap

### Next: after TestFlight testing (required before the App Store)

- **App icon.** The app still uses Expo's placeholder icon (`assets/images/icon.png`). Replace it
  with a Sigamos icon, e.g. Lotl on flame orange, using the same artwork as the website
  (`website/img/lotl-*.svg`), plus a matching splash image. Needs a new build.
- **In-app account deletion** (App Store guideline 5.1.1(v)). A "Delete account" option on the
  Me tab with a confirmation, backed by a security-definer function that deletes the user's auth
  account and cascades their data, and removes their photos and voice messages from storage.
  Then update `website/privacy/` and `website/support/`, which currently say "email us" and
  "coming soon".

1. ~~Scaffold, auth, schema~~
2. ~~HealthKit sync (workouts, steps, energy, exercise minutes, heart rate)~~
3. ~~Weekly streak engine + Home screen~~
4. ~~Accountability partners, check-in photos, reactions, nudges~~
5. ~~XP, levels, weekly league, friend streaks, celebrations~~
6. ~~Push notifications for nudges and partner workouts~~
7. ~~Pushes for partner requests, verified workouts, and streak-at-risk reminders~~
8. Achievements/badges, self-set rewards, challenges
9. Background HealthKit delivery
10. ~~Lotl mascot, daily greeting, rest mode~~
11. **Duolingo-style home-screen widget with Lotl.** Lotl's face changes with your mood
    (blazing → fired up → sleepy) and the widget nudges you like Duolingo's does:
    - **Small:** Lotl plus one line, e.g. "2 more days to keep your 6-week streak 🔥".
    - **Medium:** Lotl, this week's dots, and the most important reminder.
    - **Lock screen:** a streak count / days-left circle.
    - **Reminders it surfaces:** streak at risk (with days left), "last chance" on Sunday,
      a partner's nudge, an incentive close to done ("1 workout from Sam's ☕"), unanswered
      incentive offers or partner requests, and Rest mode.
    - Gets more urgent through the day when a workout is still needed, calms down once you've
      worked out, and taps open the right screen.
    - Needs a native WidgetKit extension (SwiftUI) plus an App Group so the app can hand it the
      latest state; refreshed when the app syncs, on a timeline through the day, and via silent
      pushes when a partner acts. Mood logic and copy already live in `src/lib/lotl.ts`
      (`lotlMood`, `LOTL_LOOKS`) and should be shared, not duplicated.

### Queued ideas (not started)

- **Short video check-ins.** Recorded only inside the app (no uploads from the library) and
  capped at a 30-second maximum to keep storage small. Needs the camera in video mode,
  compression before upload, a size limit on the `evidence` bucket, and a player on the
  workout screen.
- **Motivation from partners.** Let a partner send a motivational photo or short video
  (same in-app, 30-second limit) back to someone, e.g. in reply to a nudge or on a workout,
  with a push notification and a place to see it (Home banner or the daily greeting).
- **Hide Lotl.** A setting for people who'd rather not have a character: Home shows a plain
  header and the daily greeting becomes a simple summary card (or turns off).
- **More characters.** Two or three alternatives to Lotl with the same six moods, picked on
  the Me tab. `LOTL_LOOKS` / `lotlMood` already separate the mood logic from the drawing, so
  each character is a new drawing plus its own copy for the greeting.
