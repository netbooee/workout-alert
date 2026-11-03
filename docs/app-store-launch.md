# Sigamos 1.0: App Store launch checklist

Written for a Claude Code session on Tony's Mac with browser access, working
through App Store Connect with him. Read it top to bottom before doing
anything.

**Where things stand:** the app code, the database and a 1.0.0 TestFlight
build are ready, and the reviewer demo account works. What's left is App
Store Connect (section 2), plus the Sign in with Apple key (1c), which this
session can help with since it can use Tony's browser and Terminal. See the
Status table at the end.

**Ground rules for the browser session**

- Tony signs in to Apple, Expo and Supabase himself, including two-factor codes.
  Never type or store his passwords.
- Stop and hand over to Tony for anything that is legally binding or touches
  money: accepting agreements, tax and banking forms, content-rights and
  export declarations, and the final **Submit for Review** click. Fill in
  everything around those, then ask him to review and click.
- Use the copy in this file as written unless Tony changes it. If App Store
  Connect rejects a field (length, format), shorten it and tell him what
  changed.
- Record anything you couldn't finish in the "Status" table at the end.

## App facts

| | |
|---|---|
| App name | Sigamos |
| Bundle ID | `com.netbooee.sigamos` |
| Apple Team ID | `GB8H6683BF` |
| App Store Connect app ID | `6823272747` (already exists; TestFlight builds go here) |
| Version | **1.0.0** (set in `app.json`; EAS assigns the build number) |
| Platforms | iPhone only (`supportsTablet: false`), iOS |
| Sign-in | Sign in with Apple, or an emailed 6-digit code (Google is off in production builds) |
| Price | Free, no in-app purchases |
| Backend | Supabase project `yfwlxkjbawoamkmwhbqm` (us-east-1) |
| Website | https://sigamos.cloud (Netlify, deploys from `main`) |
| Support URL | https://sigamos.cloud/support/ |
| Privacy policy URL | https://sigamos.cloud/privacy/ |
| Contact | Antonio Martinez, netbooee@gmail.com (Tony adds a phone number for App Review) |

## 1. Blockers: do these before submitting

### 1a. A way in for Apple's reviewer (built)

Apple requires a working demo account (Guideline 2.1). Email sign-in sends a
code to an inbox the reviewer can't read, so two review addresses sign in
with a password instead (`src/lib/review-account.ts`). Typing either one on
the sign-in screen shows a password field; everyone else still gets a code.

| Account | Email | Who |
|---|---|---|
| Reviewer | `review@sigamos.cloud` | "Riley": the account Apple signs in with |
| Demo partner | `sam.review@sigamos.cloud` | "Sam Rivera": Riley's partner |

`scripts/review/seed-review-accounts.mjs` creates both accounts (or resets
them) and fills them in:
- partners for about five weeks, both on a 5-week streak
- this week Riley has 1 of 3 days, so Home says "2 more workouts"
- cheers and a comment from Sam
- a private group, "Cupertino Crew", with a 5-week squad streak
- a pep talk from Sam waiting on Riley's Home screen

Neither account joins public leagues.

**Tony runs it on the Mac, in the project folder**, right before submitting so
the current week is fresh (and again if a review drags on):

```bash
read -s SUPABASE_SECRET_KEY && export SUPABASE_SECRET_KEY
read -s REVIEW_PASSWORD && export REVIEW_PASSWORD
node --env-file=.env.local scripts/review/seed-review-accounts.mjs
```

- `SUPABASE_SECRET_KEY`: Supabase dashboard → Project Settings → **API Keys**
  → a **secret** key (`sb_secret_…`). Paste it at the silent prompt; never in a
  chat.
- `REVIEW_PASSWORD`: a new password, 10+ characters, for both accounts. It
  goes into App Store Connect (step 2f).

Then sign in on a phone as `review@sigamos.cloud` and check it looks right.

### 1b. Report and block (built)

Apple's Guideline 1.2 asks apps with user content to let people report it and
block abusive users. Built in migration `20261103000000_report_block`:

- **Report** a person, a comment, a pep talk or a workout (its photos and
  notes), with a reason. Each report keeps a copy of what was reported.
- **Block**: ends the partnership and stops partner requests, nudges and pep
  talks both ways. The other person isn't told. Unblock in Me → Settings →
  Privacy.
- **Where**:
  - **•••** at the top right of a partner's page
  - **•••** on a received pep talk
  - **•••** on an incoming partner request
  - press and hold a comment or a group member
  - "Report or block" at the bottom of a partner's workout
- The terms, the support page and the privacy policy describe it. The terms
  promise review within 24 hours.

**Reviewing reports (Tony, daily once live).** Supabase dashboard → SQL Editor:

```sql
select r.created_at, r.kind, r.reason, r.snapshot,
       reporter.display_name as reporter, reported.display_name as reported, r.id
from content_reports r
left join profiles reporter on reporter.id = r.reporter_id
left join profiles reported on reported.id = r.reported_id
where r.reviewed_at is null
order by r.created_at;

-- after dealing with one:
update content_reports set reviewed_at = now() where id = '<id>';
```

Acting on a report: delete the content in the Table Editor, or, for serious
abuse, delete the account under Authentication → Users. A later improvement
could email a notice for each new report.

### 1c. Sign in with Apple revocation (code shipped, needs Tony's key)

Account deletion revokes Sign in with Apple through the `revoke-apple` Edge
Function, which needs Apple credentials:

1. developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → +.
   Name it "Sigamos Sign in with Apple", tick **Sign in with Apple**,
   Configure → primary App ID `com.netbooee.sigamos` → Save → Continue →
   Register → **Download** the `.p8` file (only downloadable once). Note the
   Key ID.
2. In Terminal in the project folder (Tony runs this; never paste the key into
   a chat):
   ```bash
   npx supabase secrets set APPLE_TEAM_ID=GB8H6683BF APPLE_KEY_ID=<key id> APPLE_CLIENT_ID=com.netbooee.sigamos APPLE_PRIVATE_KEY="$(cat ~/Downloads/AuthKey_<key id>.p8)"
   npx supabase functions deploy revoke-apple
   ```
3. Test: on a TestFlight build, sign up with Sign in with Apple using a spare
   Apple ID, delete the account (Me tab → "Settings" (top of the screen) → scroll to the bottom → "Delete account" (below Sign out)), then check
   Settings → Apple ID → Sign-In & Security → Sign in with Apple: Sigamos
   should be gone.

### 1d. Supabase plan

Check the plan at supabase.com/dashboard → Organization → Billing. Free
projects pause after a week without traffic and have no daily backups.
For a public launch, the **Pro** plan ($25/month) is strongly recommended.
Tony decides and enters payment himself.

### 1e. Legal

Have a lawyer read https://sigamos.cloud/privacy/ and https://sigamos.cloud/terms/
(written as a starting point, not legal advice). Not a hard App Store
requirement, but recommended before a public launch.

### 1f. The 1.0.0 build

After everything above is merged to `main`:

```bash
git checkout main && git pull && npm ci
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

Wait for Apple's "build has completed processing" email, then select it on the
1.0 version page (step 2f).

## 2. App Store Connect setup (browser session)

appstoreconnect.apple.com → Apps → **Sigamos**.

### 2a. App Information (left sidebar, under General)

- **Name:** `Sigamos` (if taken: `Sigamos: Workout Streaks`)
- **Subtitle:** `Workout streaks with friends`
- **Category:** Primary **Health & Fitness**, Secondary **Social Networking**
- **Content Rights:** no third-party content. Tony confirms.
- **Age Rating:** answer the questionnaire:
  - Violence, sexual content, profanity, drugs, gambling, horror: **None**
  - Medical or treatment information: **None** (it shows fitness stats, not medical advice)
  - User-generated content: **Yes**
  - Messaging and chat: **Yes** (comments, voice messages, pep talks between partners)
  - Unrestricted web access: **No**
  - Advertising: **No**
  - Result should be **13+**, matching the privacy policy. If Apple suggests
    lower, keep 13+ (age-rating override, if offered).

### 2b. Pricing and Availability

- Price: **Free**
- Availability: all countries and regions (or the US only for a soft launch; ask Tony)

### 2c. App Privacy

Privacy policy URL: `https://sigamos.cloud/privacy/`

"Do you or your third-party partners collect data from this app?" **Yes.**

For every type below: **linked to the user's identity: Yes**, **used for
tracking: No**, purpose **App Functionality** only.

| Category | Data type | What it is in Sigamos |
|---|---|---|
| Contact Info | **Name** | Display name |
| Contact Info | **Email Address** | Sign-in and account email |
| Health & Fitness | **Health** | Workouts, heart rate during workouts, resting heart rate |
| Health & Fitness | **Fitness** | Steps, active energy, exercise minutes |
| User Content | **Photos or Videos** | Check-in photos, profile photo, pep talk photos and videos |
| User Content | **Audio Data** | Voice messages on workouts |
| User Content | **Other User Content** | Comments, notes, challenges, group names, league nickname |
| Identifiers | **User ID** | Account ID |

Do **not** select: Location (only the time zone is used), Contacts, Browsing
or Search History, Purchases, Financial Info, Usage Data, Diagnostics,
Sensitive Info, Device ID. There are no analytics or advertising SDKs.

### 2d. Version 1.0 page: text

- **Promotional text** (can change any time without review):
  > New: private groups! Race friends up the weekly leaderboard and keep a squad streak alive together. Plus pep talks: send a partner a photo or video to get them moving.
- **Keywords:**
  `accountability,partner,fitness,habit,gym,exercise,motivation,group,league,running,steps,health,team`
- **Support URL:** `https://sigamos.cloud/support/`
- **Marketing URL:** `https://sigamos.cloud`
- **Copyright:** `2026 Antonio Martinez`
- **Description:**

  > Sigamos (see-GAH-mohs) is Spanish for "let's keep going." It's a workout streak you keep alive with the people who keep you honest.
  >
  > SET A WEEKLY GOAL
  > Pick how many days a week you'll work out. Hit it and your streak grows. Miss a week and a streak freeze can save you. Sick or traveling? Rest mode pauses everything.
  >
  > WORKOUTS COUNT AUTOMATICALLY
  > Anything you record with Apple Watch, the Fitness app, Strava, Peloton or any app that saves to Apple Health shows up on its own. You can also log a workout by hand.
  >
  > BETTER WITH PARTNERS
  > Invite a friend with a link. See each other's workouts, cheer, comment, send voice messages, and verify each other's check-in photos. Nudge a partner who's falling behind, or send a pep talk: a photo or a 30-second video to get them moving.
  >
  > PRIVATE GROUPS
  > Start a group for your family, your office or your gym crew. Race up the weekly leaderboard, crown last week's winner, and keep a squad streak alive together.
  >
  > CHALLENGES AND LEAGUES
  > Challenge a partner ("4 workouts this week and coffee's on me") or take one on together. Earn XP for every workout, level up, and climb from Spark to Inferno in optional public leagues.
  >
  > YOUR BUDDY
  > Lotl, Capi, Lento or Canela cheers you on, and their mood follows your week. Put them on your Home Screen with the widget.
  >
  > PRIVATE BY DESIGN
  > Your workouts are shared only with the partners you accept. Sigamos never sells your data, shows no ads, and only reads from Apple Health; it never writes to it.

- **What's New:** not shown for a first version.

### 2e. Screenshots

Required: **6.9-inch iPhone** (1320 × 2868 portrait). Apple scales these down
for smaller iPhones. No iPad screenshots (iPhone only).

Capture on a TestFlight build on a real iPhone with good-looking data (the
demo accounts from 1a are ideal), or in the Simulator on **iPhone 17 Pro Max**
(⌘S saves a screenshot to the Desktop). Light mode, full battery, 9:41 if
possible. Order:

1. **Home**: big streak number, week dots, the "today" sentence, the crew card
2. **Celebration** after logging a workout: confetti, +XP
3. **Private group**, Squad tab: squad streak and who's made it
4. **A partner's page** with workouts and the 📣 Pep talk button
5. **Pep talk viewer** (a fun photo with a message)
6. **Leagues** table with medals
7. **Me** with the stat tiles, or **the widget** on a Home Screen

Optional: a short caption at the top of each ("Keep the streak alive
together", and so on) made in Figma or Canva. Plain screenshots are fine for
1.0.

### 2f. Build, review information and release

- **Build:** select **1.0.0 (N)** from step 1f.
- **Sign-in required:** Yes. Username `review@sigamos.cloud`, password `REVIEW_PASSWORD` from 1a.
- **Contact:** Antonio Martinez, netbooee@gmail.com, Tony's phone.
- **Notes for the reviewer:**

  > Sigamos is a workout-accountability app. Partners keep weekly workout streaks together.
  >
  > DEMO ACCOUNT: on the sign-in screen, type review@sigamos.cloud in the email field. A password field appears; enter the password above. The account ("Riley") is paired with a demo partner, "Sam", so you can see partner workouts, cheers and comments (Partners tab), a private group with a squad streak (Partners → Your groups), and a pep talk from Sam on Home.
  >
  > APPLE HEALTH: Sigamos reads workouts, steps, active energy, exercise minutes and heart rate (with permission) to count workouts toward the weekly goal. It never writes to Health. Without Health access, workouts can be logged by hand with "+ Log" on Home.
  >
  > CAMERA AND MICROPHONE: for optional check-in photos, voice messages and pep talk videos (Partners → a partner → 📣 Pep talk).
  >
  > ACCOUNT DELETION: Me tab → "Settings" (top of the screen) → scroll to the bottom → "Delete account" (below Sign out). It deletes everything immediately and revokes Sign in with Apple.
  >
  > REPORTING AND BLOCKING: open a partner (Partners → Sam) and tap ••• at the top right to report or block them. Comments and group members: press and hold. Pep talks: ••• next to the close button. Blocked people are listed in Me → Settings → Privacy. Reports are reviewed within 24 hours.
  >
  > There are no in-app purchases, ads or tracking.

- **Version release:** **Manually release this version**, so Tony picks launch day.

### 2g. Before Tony clicks Submit for Review

- [ ] Every field above is filled, and screenshots are uploaded
- [ ] The demo account works on the selected build (sign in on a phone)
- [ ] The website is live with the current privacy policy and support pages
- [ ] The seed script (1a) ran today, and the reviewer note matches
- [x] Sign in with Apple revocation (1c) works
- [ ] Tony has reviewed the age rating and privacy answers

Apple usually reviews within 1–3 days. A rejection comes with a message in
App Store Connect → App Review; answer it there or fix and resubmit.

## 3. Launch day and after

- Release in App Store Connect (manual release).
- Update the website: swap the TestFlight "Get the beta" buttons for an App
  Store badge and link, and replace the sample screenshots with real ones.
- Tell TestFlight testers to install the App Store version (their data carries
  over, same backend).
- Keep TestFlight for future betas.

## Status

Last updated by the local browser session, 2026-11-02.

| Item | Status |
|---|---|
| Version set to 1.0.0 | Done |
| 1a Reviewer demo account | Done. Rerun the seed script right before Submit for Review |
| 1b Report and block | Done and live (migrations through `20261104000000` applied) |
| 1c Apple revocation secrets | **Done.** Key 8JAJQNTM6D; all four APPLE_* secrets set (digests checked), `revoke-apple` deployed. Tested 2026-11-02 on TestFlight: Sign in with Apple account deleted, all its data gone, and Sigamos removed from the iPhone's Sign in with Apple list |
| 1d Supabase plan | **Ask Tony** whether he has checked it |
| 1e Legal review | Tony's call; doesn't block submission |
| 1f 1.0.0 build | Done. Build 12 (1.0.0) |
| 2a App Information | Done: subtitle, categories, age rating 13+ (not sold in Afghanistan or Morocco), declared not a regulated medical device. **Content Rights: Tony to declare** |
| 2b Pricing and Availability | Done: Free, 174 countries and regions (China mainland removed: no ICP filing) |
| 2c App Privacy | Answers entered as in 2c. **Tony to review and click Publish** |
| 2d Version text | Done |
| 2e Screenshots | Done: 8 on the medium-display iPhone slot, which is the required slot in App Store Connect now (6.9-inch is optional) |
| 2f Build, review info, release | Done: build 12, demo account, contact, notes, manual release |
| 2g Submit for Review | **Tony**, after 1c and the items marked above |
