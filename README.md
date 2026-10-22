# Sigamos

*Spanish for "let's keep going."*

An iOS app for working out with friends and family. Workouts sync automatically
from Apple Health, and a **weekly streak** grows every week you hit your goal.

## How streaks work

- You pick a goal of **1–7 workout days per week** (weeks run Sunday–Saturday in your timezone, shown as S M T W T F S).
  Weeks hit back when weeks started on Monday stay hit after the switch.
- A day counts when it has at least one workout of **15+ minutes**. Two workouts on one day still count as one day.
- Hit your goal and the streak grows by one week. The current week never breaks your streak while it's still in progress.
- Every **4 weeks hit** earns a **streak freeze** (max 2). A missed week automatically spends a freeze instead of resetting the streak.
- The first sync looks back 12 weeks, so an existing habit shows up as a streak on day one.
- **Two trackers, one workout.** Wearing more than one device (say an Apple Watch and a Whoop)
  records most workouts twice in Apple Health. Overlapping workouts from different devices
  (overlapping by at least half of the shorter one) count once: the richest copy stays (heart
  rate, then longest), the others are folded into it (`workouts.duplicate_of`) and show as
  "Also recorded by …". A workout only one device caught still counts. Folded copies earn no
  XP, don't count toward incentives, and don't trigger a second partner notification;
  reactions, comments, and photos on them move to the copy that counts.
- Changing your goal applies to the current week and to the **weeks from before you joined**
  (your imported history), so picking a realistic goal on day one counts your past. Weeks since
  you joined keep the goal they had, so lowering it later can't rewrite them.

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
- Partners **Cheer** a workout (👏, or hold for 🔥 or 💪; tap again to take it back) or
  **Verify** it (you saw them do it; explained the first time; you can't verify your own).
- **Cheer on your partners**: partner workouts from the last 3 days you haven't cheered or
  verified show on Home (up to 3) and at the top of the Partners tab, with Cheer and Verify
  on each row. A row stays after a cheer so you can still verify; it leaves when you verify,
  when you dismiss it with ✕ (remembered on the phone), or next time you open the app if you
  only cheered. The Partners tab icon counts workouts you haven't touched, plus partner
  requests (`src/lib/cheers.ts`, `src/lib/cheer-list-store.ts`, `src/components/cheer-card.tsx`).
- **"Just worked out" pushes** have **👏 Cheer** and **✅ Verify** buttons (long-press or pull
  down the notification). Tapping one saves the reaction and opens the workout showing it.
  The server sends these pushes with the `partner_workout` category
  (`20261023000000_partner_workout_actions.sql`); the app registers the buttons
  (`src/lib/notification-actions.ts`). The buttons open the app because that's the reliable
  way on iOS for the app to save the reaction; reacting without opening it would need a
  native notification extension.
- **Home** order: your streak and this week first, then nudges, partners to cheer, active
  challenges and recent workouts; today's activity rings and the trend are at the bottom. The
  header has a small level chip (tap for How XP works) and a labeled **+ Log** button.
- **Me** has three sections: **You** (goal, What counts, buddy, rest mode, invite code),
  **Progress** (level, streak stats, history, chart, reward shelf) and **Settings**
  (appearance, notifications, Apple Health, help, sign out, delete account).
- **Log a workout** by hand with any duration (− / + by 5 minutes, or a preset) and when you
  finished, up to 14 days back (`src/lib/log-workout.ts`).
- **Feed cards** all have the same shape: a square on the left (the first photo's thumbnail
  with a "+N" badge, or the workout's icon), three single lines (who and what; duration,
  heart rate and when; the note or where it was recorded), then Cheer and Verify. Tapping the
  thumbnail opens the photos full screen (swipe, pinch to zoom, save).
- **Partners tab** order: requests, workouts to cheer, partner cards, partner activity, then
  the league (only with 2+ partners) and the incentive intro. Tapping a partner card opens
  their page (`src/app/partner/[id].tsx`): streak, this week, weeks together, Nudge,
  Incentive, anything going on between you, and their recent workouts.
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

## What counts

**Me → What counts** sets the shortest workout that counts (10, 15, 20 or 30 minutes; default
15) and a separate bar for walks (same, 20, 30 or 45 minutes, or never), because phone apps
save lots of short auto-detected walks to Apple Health. A workout under the bar is still
stored and shown faded with "Didn't count" in your own lists, but it doesn't count toward the
streak, XP, incentives or quests, doesn't notify partners, and stays out of their feed.
`workouts.counted` holds the answer (set on write by `public.workout_counts()`, refreshed for
all of your workouts when you change the rules) so the database and the app agree; the client
mirror is `src/lib/what-counts.ts`. Logic: `supabase/migrations/20261022000000_what_counts.sql`
(pgTAP in `supabase/tests/what_counts.test.sql`).

## Challenges (incentives in the code)

In the app this is one idea, a **🎯 Challenge**, with two kinds: **Reward them** (an
incentive: your partner works toward a goal and you treat them) and **Do it together** (a
shared quest: both of your workouts count). Tables and functions keep the incentive names;
pushes and messages say "challenge" (`20261025000000_challenge_wording.sql`).


A partner can reward you for extra effort: **"Hit 5 workout days this week → ☕ Coffee on me"**.

- **Offer** from a partner's card (🎁 Offer an incentive), a partner's workout, or the intro card
  on the Partners tab. Goals: workout days, active minutes, a number of workouts (optionally one
  type, e.g. 3 runs; **Strength** counts traditional, functional and core strength workouts), or reaching a streak length; over 1, 2, or 4 weeks counted from this Sunday
  in the recipient's timezone. Rewards are real-world text (no money in the app).
- **Rewards**: eight favorite tiles plus **More…**, a searchable sheet of about 50 suggestions
  in groups (food, time together, pampering, chores, fitness, bigger stakes). Any pick is just
  editable text; Custom, Cash prize and Gift card jump straight into it. No alcohol suggestions,
  to keep the App Store age rating simple. The library is `REWARD_LIBRARY` in
  `src/lib/incentives.ts`.
- **Verified only** (off by default) counts only Apple Health workouts or ones a partner verified.
- The recipient accepts or passes. Progress updates automatically from workouts (computed in
  Postgres). Hitting the goal earns it: **+100 XP**, a celebration, and pushes to both people.
  The giver marks it **delivered**; it lands on the recipient's **reward shelf** (Me tab).
- An active incentive shows as a **quest card** (like Duolingo's Friends Quest,
  `src/components/quest-progress.tsx`): the count, one pip per day or workout (a bar for
  minutes), what's left and the days remaining, with the next action on the card: **Log a
  workout** for the recipient on Home, **Nudge** for the giver. The giver's partner card shows
  the same progress. The nudge banner also has **Log a workout**.
- **Do it together** (shared quests; the **Do it together** switch on the challenge screen) work like Duolingo's Friends
  Quest: both partners' workouts count toward one goal ("8 workout days between us this week →
  🍕 Pizza night together"). Workout days, workouts or minutes, with targets up to twice as high;
  not streak weeks. The quest card splits the pips by person (yours, then theirs). Finishing it
  gives **both** people +100 XP, and either of them can mark the reward done. Logic:
  `supabase/migrations/20261021000000_shared_quests.sql` (pgTAP in
  `supabase/tests/shared_quests.test.sql`).
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
  After that it lives in the Home header; tap it to see the greeting again. "First open"
  includes resuming the app from the background, but the greeting never covers a screen you
  opened on purpose (logging a workout, or one a notification took you to).
- Playful, never shaming: never angry when a freeze covers the week, and "fired up" only on
  the daily greeting (the header calms down to worried).
- Mood rules and copy live in `src/lib/lotl.ts` (unit-tested); the drawing is
  `src/components/lotl.tsx`. The mood → color/scale table is shared so a widget can match.
- **Pick your buddy** on the Me tab, free to switch any time: Lotl, **Capi** the capybara,
  **Lento** the sloth, or **Canela** the red panda (`profiles.mascot`). All four show the
  same six moods with the same signature on the face (sunglasses, ^ ^ eyes, sweatband,
  sweat drop, gritted teeth, sleep bubble); ears and arms stand in for Lotl's gills. Each
  has its own voice mixed into the shared greeting lines.
- **Partners see your buddy** on your partner card, in a mood that matches your week
  (never fired up; asleep in rest mode, which is only shared once you're partners).
- Drawings live in `src/components/mascots/` (shared face and motion, one file per animal).

## Onboarding

**Onboarding** has a progress bar and the buddy speaking on every step. It starts with picking
your buddy (`src/components/buddy-chooser.tsx`): the chosen character springs onto a stage,
wiggles, and sparkles burst around it while the others nap in their tiles; that buddy then
asks the rest. Then a name (skipped when Sign in with Apple provides one), the weekly goal, Apple Health, notifications, and finally a
partner step to share an invite or enter a code. An invite link opened before sign-in or
onboarding is kept (`src/lib/pending-invite.ts`) and offered on that last step. Invites are
shared as `https://sigamos.cloud/invite/CODE`, which opens the app or offers the beta.

## Welcome tour

The first time someone opens the app (after onboarding) they get a six-page swipeable tour:
what Sigamos is, how the weekly streak works, partners, incentives, XP and levels, and picking
a buddy plus the widget. **Skip** works on every page before the last, and it takes the place of that day's
greeting so two pop-ups never stack. Reopen it any time from **Me → Help → Show the welcome
tour** (`src/app/welcome.tsx`; seen-state is per account in AsyncStorage).

Tapping the level bar (Home, Me) opens **How XP works** (`src/app/xp.tsx`): what earns XP,
what resets (XP never does; the league restarts every Sunday), and the level titles. The
rules live in `src/lib/xp-rules.ts` and must match the amounts in the migrations.

## Rest mode

Sick, injured, or traveling? Turn on Rest mode (Me tab). Weeks you don't hit are marked
*rest*: they don't break your streak, don't spend a freeze, and hold friend streaks. Streak
reminders pause. Workouts during rest still count.

## Appearance

Light, dark, or **Automatic** (follows the iPhone), set on the Me tab. Theme colors in
`src/constants/theme.ts` are iOS dynamic colors with a light and dark value each, so static
styles re-color instantly; React Navigation gets plain hex values via `Palettes`.

## Widget

A home-screen and Lock Screen widget (iOS) built with `expo-widgets`, showing **your chosen
buddy** in the mood that matches your week.

- **Small:** your buddy, streak, one message, and the week's dots.
- **Medium:** adds day letters and the one reminder that matters most: a partner request or
  incentive offer waiting on you, today's nudge, an incentive you're close to earning, a
  partner who already worked out today, or your league rank.
- **Lock Screen:** a ring for this week's days with your streak, a three-line rectangle, and
  an inline line above the clock. Lock Screen versions never show partners' names.
- **Through the day:** the app hands the widget a timeline for the rest of the week, assuming
  no new workouts, so it changes on its own: gentle in the morning, firmer at 1 PM, and
  urgent (fired up) at 6 PM when today has to count. It calms down once you've worked out.
- **Taps** open the right screen (an offer, Partners, Log a workout, or Home).
- Refreshed whenever the app opens, syncs, comes back to the foreground, or you switch
  buddies. Signing out clears it.
- What it says lives in `src/lib/widget.ts` (unit-tested); the SwiftUI layout is
  `src/widgets/streak-widget.tsx`. Buddy pictures are pre-rendered PNGs in `assets/mascots/`
  (re-export them from `src/components/mascots/` when the drawings change, and bump
  `VERSION` in `src/widgets/pictures.ts`); the app copies them into the shared App Group
  (`group.com.netbooee.sigamos`) for the widget.

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
  left this week: 3 to go." On Saturday: "Last chance to keep your 5-week streak 🔥". At most once a
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
| Check-in photo on a workout (once per workout) | +25 |
| Daily steps: 5,000 / 8,000 / 12,000 (up to 25 a day; XP only, never streaks or challenges) | +5 / +10 / +10 |
| Hitting your weekly goal | +50 |
| Earning a partner's incentive | +100 |
| A partner verifies your workout (✅), once per workout | +5 |
| Verifying a partner's workout (up to 3 a day) | +2 |

- **Levels** get progressively longer: L2 at 100 XP, L3 at 300, L5 at 1,000, L10 at 4,500.
- **Weekly league**: you and your partners ranked by XP earned this week (Sun–Sat).
- **Public leagues** (opt in from Partners → Public leagues, or Me → Settings → Privacy):
  - Each week your first XP puts you in a group of up to 20 people at your tier, matched by time zone band so the week ends at about the same time for everyone.
  - Tiers: ✨ Spark → 🔸 Ember → 🔥 Flame → ☄️ Blaze → 🌋 Inferno. At the end of the week the top quarter (up to 5) move up. The bottom 15% (up to 3) move down, along with anyone with no XP; nobody drops out of Spark.
  - Strangers see only a first name or nickname, your buddy, your weekly XP and your tier. Never workouts, photos, streaks or partners.
  - To keep it fair, hand-logged workouts without a photo count half in public leagues.
  - Anyone in your group can be reported. Reports land in `league_reports`.
  - Groups close hourly once the week is over everywhere (`close_league_weeks`, via pg_cron).
- **Friend streak**: with each partner, the number of consecutive weeks you *both* hit
  your goals since becoming partners.
- A **celebration screen** pops up when new XP lands (after a sync, a manual log, or a photo),
  including a new account's first workout. New workouts get a second step with the streak, the
  week's dots and what's next, plus a callout for a milestone (2, 4, 8, 12, 26, 52, 104 weeks)
  or a freeze earned that week.
- Tapping the streak card on Home opens the **streak screen**. **Personal**: next milestone,
  freezes banked and how they're earned, and week-by-week history linking to each week.
  **Friends**: a friend streak row per partner ("🔥 12 weeks together"), open "Invite a friend"
  slots, and **Edit** to remove a partner. The "wk together" badge on a partner card opens it.
- **Verifying** doesn't change streaks: every 15+ minute workout counts, verified or not. It
  earns XP on both sides, and "verified only" incentives count hand-logged workouts only once a
  partner verifies them. Removing a ✅ takes its XP back.

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
  onboarding.tsx         Buddy, name (if missing), goal, Apple Health, notifications, invite a partner
  (tabs)/index.tsx       Home: streak + week dots, rings, 8-week trend, recent workouts
  (tabs)/partners.tsx    League, partner cards, requests, partner activity feed
  league.tsx             Public leagues (join, group table, results) and the partner league
  (tabs)/me.tsx          Level, stats, 12-week history, progress chart, goal, invite code
  week/[start].tsx       One week from the progress chart: totals and workouts by day
  workout/[id].tsx       Workout detail: check-in photos, note, cheers
  partner/[id].tsx       A partner's page: streaks, actions, recent workouts
  log.tsx                Log a workout by hand with a check-in photo
  add-partner.tsx        Share your code / enter someone else's
  invite/[code].tsx      Deep link handler for invites
  celebrate.tsx          "+XP" celebration, then the streak step
  streak.tsx             Streak detail: milestone, freezes, week-by-week history
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
`@` (A record) and `www` (CNAME) at Netlify. The beta buttons use the public TestFlight link
(https://testflight.apple.com/join/epCEHKDt) in `website/index.html` (hero, "Join the beta" steps, and CTA) and
`website/invite/index.html`. Screenshots in
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

- ~~**App icon.**~~ Lotl (blazing, in sunglasses) on flame orange, rendered from
  `website/img/lotl-blazing.svg`; the splash is happy Lotl (`assets/images/`).
- ~~**In-app account deletion**~~ (App Store guideline 5.1.1(v)): "Delete account" on the Me
  tab removes the user's files from storage, then `delete_my_account()` deletes the auth user and
  cascades their data. Still to do: revoke the Sign in with Apple token on deletion (Apple asks
  for this; it needs a server-side call with the app's client secret), and update
  `website/privacy/` and `website/support/`, which say "email us" and "coming soon", once a
  build with deletion is out.

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
11. ~~Home-screen and Lock Screen widget with your buddy~~ (see "Widget" above). Next:
    refresh it in the background (background task or silent pushes when a partner acts),
    since today it updates when the app opens, syncs, or comes back to the foreground.

### Beta and website launch

- ~~**Public TestFlight link.**~~ https://testflight.apple.com/join/epCEHKDt, used by the
  website's beta buttons.
- **External TestFlight testing.** Testers outside the team need Apple's Beta App Review:
  fill in the beta description, feedback email, and a demo sign-in for the reviewer, then add
  an external group.
- **Legal review.** Have a lawyer review `website/privacy/` and `website/terms/` before the
  App Store launch (they were written as a starting point, not legal advice).
- **Real screenshots.** The website images (`website/img/*.webp`) come from a web preview with
  sample data. Replace them with screenshots from a real iPhone (light and dark) once the
  TestFlight build is in use.

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
- **Special characters (one-time purchases).** Extra characters beyond the free four, bought
  once (no subscription). To be designed later: which characters, pricing, App Store in-app
  purchases (StoreKit, e.g. via `expo-iap` or RevenueCat), restoring purchases, and how
  partners see a bought character.
