import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelBar } from '@/components/level-bar';
import { PushPrompt } from '@/components/push-prompt';
import { StreakHistory } from '@/components/streak-history';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useHomeData, useStreakHistory } from '@/hooks/use-home-data';
import { useXpTotal } from '@/hooks/use-social';
import { signOut, useProfile, useUpdateProfile } from '@/lib/auth';
import { resetHealthSync, syncHealthData } from '@/lib/health/sync';

export default function MeScreen() {
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
        <AppText variant="title">{profile.display_name ?? 'You'}</AppText>
        <Card>
          <LevelBar xp={xp ?? 0} />
          <AppText variant="caption">
            {xp ?? 0} XP total · Earn XP for every workout, check-in photo, and each week you hit
            your goal.
          </AppText>
        </Card>

        <View style={styles.stats}>
          <Stat label="Current" value={home?.streak?.current_weeks ?? 0} unit="wks" color={Colors.flame} />
          <Stat label="Longest" value={home?.streak?.longest_weeks ?? 0} unit="wks" />
          <Stat label="Freezes" value={home?.streak?.freezes_banked ?? 0} color={Colors.freeze} />
        </View>

        <StreakHistory weeks={history ?? []} />

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
            Changes apply to this week right away. Past weeks keep the goal they had.
          </AppText>
        </Card>

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

        <Card>
          <AppText variant="label">Notifications</AppText>
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

        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: number; unit?: string; color?: string }) {
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: { flex: 1, gap: Spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
