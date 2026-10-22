import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View, type ColorValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { LevelBar } from '@/components/level-bar';
import { MascotPicker } from '@/components/mascot-picker';
import { Mascot } from '@/components/mascots';
import { ProgressChart } from '@/components/progress-chart';
import { PushPrompt } from '@/components/push-prompt';
import { RewardShelf } from '@/components/reward-shelf';
import { StreakHistory } from '@/components/streak-history';
import { AppText, Button, Card, Segmented } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useHomeData, useStreakHistory } from '@/hooks/use-home-data';
import { useXpTotal } from '@/hooks/use-social';
import { useAppearancePref, type AppearancePref } from '@/lib/appearance';
import { deleteAccount, signOut, useProfile, useUpdateProfile } from '@/lib/auth';
import { resetHealthSync, syncHealthData } from '@/lib/health/sync';
import { mascotKind } from '@/lib/mascots';
import {
  MIN_WORKOUT_OPTIONS,
  rulesSummary,
  WALK_OPTIONS,
  walkChoice,
  walkRules,
  type WalkChoice,
} from '@/lib/what-counts';
import { supabase } from '@/lib/supabase';

export default function MeScreen() {
  // You (goal, buddy, what counts), Progress (stats and history), Settings. Home links to Progress.
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<MeSection>(isMeSection(params.section) ? params.section : 'you');
  const [linkedSection, setLinkedSection] = useState(params.section);
  if (params.section !== linkedSection) {
    setLinkedSection(params.section);
    if (isMeSection(params.section)) setSection(params.section);
  }
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: home, refetch } = useHomeData();
  const { data: history } = useStreakHistory();
  const { data: xp } = useXpTotal();
  const [resyncing, setResyncing] = useState(false);

  const setGoal = async (goal: number) => {
    if (goal < 1 || goal > 7 || goal === profile.weekly_goal) return;
    Haptics.selectionAsync();
    try {
      await updateProfile({ weekly_goal: goal });
    } catch (e) {
      Alert.alert('Could not update goal', e instanceof Error ? e.message : String(e));
    }
  };

  const editName = () =>
    Alert.prompt(
      'Your name',
      'This is how partners see you.',
      async (value) => {
        const name = value.trim().slice(0, 40);
        if (!name || name === profile.display_name) return;
        try {
          await updateProfile({ display_name: name });
        } catch (e) {
          Alert.alert('Could not save your name', e instanceof Error ? e.message : String(e));
        }
      },
      'plain-text',
      profile.display_name ?? '',
    );

  const resync = async () => {
    setResyncing(true);
    try {
      await resetHealthSync(profile.id);
      await syncHealthData(profile.id);
      await refetch();
    } catch (e) {
      Alert.alert('Sync failed', e instanceof Error ? e.message : String(e));
    } finally {
      setResyncing(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.nameCard}>
          <Avatar id={profile.id} name={profile.display_name} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="title" numberOfLines={1}>
              {profile.display_name ?? 'Add your name'}
            </AppText>
            <AppText variant="caption">This is how partners see you</AppText>
          </View>
          <Pressable
            onPress={editName}
            accessibilityRole="button"
            accessibilityLabel={profile.display_name ? 'Edit name' : 'Add your name'}
            style={styles.editName}>
            <SymbolView name="pencil" size={14} weight="semibold" tintColor={Colors.flame} />
            <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
              {profile.display_name ? 'Edit' : 'Add'}
            </AppText>
          </Pressable>
        </Card>
        <Segmented
          options={[
            { key: 'you', label: 'You' },
            { key: 'progress', label: 'Progress' },
            { key: 'settings', label: 'Settings' },
          ]}
          value={section}
          onChange={setSection}
        />

        {section === 'you' && (
          <>
            <Card>
              <AppText variant="label">Weekly goal</AppText>
              <View style={styles.stepper}>
                <StepButton label="−" onPress={() => setGoal(profile.weekly_goal - 1)} />
                <AppText variant="title">
                  {profile.weekly_goal}
                  <AppText variant="caption"> days / week</AppText>
                </AppText>
                <StepButton label="+" onPress={() => setGoal(profile.weekly_goal + 1)} />
              </View>
              <AppText variant="caption">
                Changes apply to this week right away, and to the weeks from before you joined. Weeks
                since you joined keep the goal they had.
              </AppText>
            </Card>

            <WhatCountsCard />

            <MascotPicker />

            <RestModeCard resting={!!profile.resting_since} />

            <Card>
              <AppText variant="label">Your invite code</AppText>
              <View style={styles.inviteRow}>
                <AppText variant="title" color={Colors.flame} style={{ letterSpacing: 4 }} selectable>
                  {profile.invite_code}
                </AppText>
                <Link href="/add-partner" asChild>
                  <Button title="Share" variant="secondary" style={{ height: 40 }} />
                </Link>
              </View>
            </Card>

          </>
        )}

        {section === 'progress' && (
          <>
            <Card>
              <LevelBar xp={xp ?? 0} />
              <AppText variant="caption">
                {xp ?? 0} XP total · Tap the bar to see how XP works.
              </AppText>
            </Card>

            <View style={styles.stats}>
              <Stat label="Current" value={home?.streak?.current_weeks ?? 0} unit="wks" color={Colors.flame} />
              <Stat label="Longest" value={home?.streak?.longest_weeks ?? 0} unit="wks" />
              <Stat label="Freezes" value={home?.streak?.freezes_banked ?? 0} color={Colors.freeze} />
            </View>

            <StreakHistory weeks={history ?? []} />
            <ProgressChart />
            <RewardShelf />

          </>
        )}

        {section === 'settings' && (
          <>
            <AppearanceCard />

            <Card>
              <AppText variant="label">Notifications</AppText>
              <Toggle
                label="Streak at risk reminders"
                value={profile.notify_streak_reminders}
                onChange={(v) => updateProfile({ notify_streak_reminders: v })}
              />
              <Toggle
                label="Nudges from partners"
                value={profile.notify_nudges}
                onChange={(v) => updateProfile({ notify_nudges: v })}
              />
              <Toggle
                label="When a partner works out"
                value={profile.notify_partner_workouts}
                onChange={(v) => updateProfile({ notify_partner_workouts: v })}
              />
              <Toggle
                label="When a partner verifies your workout"
                value={profile.notify_verifications}
                onChange={(v) => updateProfile({ notify_verifications: v })}
              />
              <Toggle
                label="Incentives"
                value={profile.notify_incentives}
                onChange={(v) => updateProfile({ notify_incentives: v })}
              />
              <Toggle
                label="Comments and voice messages"
                value={profile.notify_comments}
                onChange={(v) => updateProfile({ notify_comments: v })}
              />
              <Toggle
                label="Partner requests"
                value={profile.notify_partner_requests}
                onChange={(v) => updateProfile({ notify_partner_requests: v })}
              />
            </Card>
            <PushPrompt />

            <Card>
              <AppText variant="label">Apple Health</AppText>
              <AppText variant="caption">
                Workouts sync automatically when you open the app. If something looks missing, re-sync
                the last 12 weeks.
              </AppText>
              <Button title="Re-sync health data" variant="secondary" loading={resyncing} onPress={resync} />
            </Card>

            <Card>
              <AppText variant="label">Help</AppText>
              <AppText variant="caption">A quick tour of streaks, partners, incentives, and your buddy.</AppText>
              <Link href="/welcome" asChild>
                <Button title="Show the welcome tour" variant="secondary" />
              </Link>
              <Button
                title="Help and support"
                variant="secondary"
                onPress={() => Linking.openURL('https://sigamos.cloud/support/')}
              />
            </Card>

            <Button title="Sign out" variant="secondary" onPress={confirmSignOut} />
            <Pressable accessibilityRole="button" onPress={() => confirmDeleteAccount(profile.id)} style={styles.deleteAccount}>
              <AppText variant="body" color={Colors.danger}>
                Delete account
              </AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The shortest workout that counts, and a separate bar for walks (short auto-detected walks are noisy). */
function WhatCountsCard() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const [saving, setSaving] = useState(false);

  const save = async (patch: Parameters<typeof updateProfile>[0]) => {
    Haptics.selectionAsync();
    setSaving(true);
    try {
      await updateProfile(patch);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  return (
    <Card style={{ gap: Spacing.sm }}>
      <AppText variant="label">What counts</AppText>
      <AppText variant="caption">Shortest workout</AppText>
      <View style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
        <Segmented
          options={MIN_WORKOUT_OPTIONS.map((m) => ({ key: String(m), label: `${m} min` }))}
          value={String(profile.min_workout_minutes)}
          onChange={(m) => save({ min_workout_minutes: Number(m) })}
        />
      </View>
      <AppText variant="caption">Walks count from</AppText>
      <View style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
        <Segmented<WalkChoice>
          options={WALK_OPTIONS}
          value={walkChoice(profile)}
          onChange={(choice) => save(walkRules(choice))}
        />
      </View>
      <AppText variant="caption">
        {rulesSummary(profile)} Shorter ones stay in your history but don’t count toward your
        streak, XP or incentives, and your partners aren’t notified.
      </AppText>
    </Card>
  );
}

type MeSection = 'you' | 'progress' | 'settings';
const isMeSection = (v: unknown): v is MeSection => v === 'you' || v === 'progress' || v === 'settings';

function confirmSignOut() {
  Alert.alert('Sign out?', 'Your streak and workouts stay saved to your account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
  ]);
}

function confirmDeleteAccount(userId: string) {
  Alert.alert(
    'Delete your account?',
    'This permanently deletes your streak, workouts, photos, messages, partners and rewards. It can’t be undone. Workouts in Apple Health are not touched.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: () =>
          deleteAccount(userId).catch((e) =>
            Alert.alert('Could not delete your account', e instanceof Error ? e.message : String(e)),
          ),
      },
    ],
  );
}

function Stat({ label, value, unit, color }: { label: string; value: number; unit?: string; color?: ColorValue }) {
  return (
    <Card style={styles.stat}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="title" color={color}>
        {value}
        {unit ? <AppText variant="caption"> {unit}</AppText> : null}
      </AppText>
    </Card>
  );
}

function RestModeCard({ resting }: { resting: boolean }) {
  const { mascot } = useProfile();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const setRest = async (on: boolean) => {
    setSaving(true);
    const { error } = await supabase.rpc('set_rest_mode', { p_on: on });
    setSaving(false);
    if (error) Alert.alert('Could not change rest mode', error.message);
    await queryClient.invalidateQueries();
  };

  return (
    <Card>
      <View style={styles.restRow}>
        <Mascot kind={mascotKind(mascot)} mood={resting ? 'sleepy' : 'ready'} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Rest mode</AppText>
          <AppText variant="caption">
            Sick, injured, or traveling? Missed weeks won’t break your streak (or use a freeze),
            and reminders pause. Workouts still count.
          </AppText>
        </View>
        <Switch value={resting} disabled={saving} trackColor={{ true: Colors.rest }} onValueChange={setRest} />
      </View>
    </Card>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => Promise<unknown> }) {
  return (
    <View style={styles.toggle}>
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
      <Switch
        value={value}
        trackColor={{ true: Colors.flame }}
        onValueChange={(v) => {
          onChange(v).catch((e) => Alert.alert('Could not save', e instanceof Error ? e.message : String(e)));
        }}
      />
    </View>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.7 }]}>
      <AppText variant="title">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  deleteAccount: { alignSelf: 'center', padding: Spacing.sm },
  nameCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  editName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.flameSoft,
    borderWidth: 1,
    borderColor: Colors.flame,
  },
  appearanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: { flex: 1, gap: Spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const APPEARANCE_OPTIONS: { key: AppearancePref; label: string }[] = [
  { key: 'system', label: 'Automatic' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

function AppearanceCard() {
  const [pref, setPref] = useAppearancePref();
  return (
    <Card>
      <View style={styles.appearanceRow}>
        <AppText variant="label">Appearance</AppText>
        <Segmented options={APPEARANCE_OPTIONS} value={pref} onChange={setPref} />
      </View>
      <AppText variant="caption">Automatic follows your iPhone’s light or dark setting.</AppText>
    </Card>
  );
}
