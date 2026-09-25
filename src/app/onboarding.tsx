import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth, useUpdateProfile } from '@/lib/auth';
import { healthAvailable, requestHealthPermissions } from '@/lib/health/healthkit';

const GOAL_HINTS: Record<number, string> = {
  1: 'Easing in',
  2: 'Building the habit',
  3: 'Solid and sustainable',
  4: 'Committed',
  5: 'Most weekdays',
  6: 'One rest day',
  7: 'Every single day',
};

export default function OnboardingScreen() {
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const [step, setStep] = useState<'goal' | 'health'>('goal');
  const [goal, setGoal] = useState(profile?.weekly_goal ?? 3);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      if (healthAvailable()) await requestHealthPermissions();
      await updateProfile({
        weekly_goal: goal,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboarded_at: new Date().toISOString(),
      });
      // The root navigator switches to the tabs once onboarded_at is set.
    } catch (e) {
      Alert.alert('Could not finish setup', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {step === 'goal' ? (
        <>
          <View style={styles.body}>
            <AppText variant="label">Step 1 of 2</AppText>
            <AppText variant="title">How many days a week do you want to work out?</AppText>
            <AppText variant="body" color={Colors.textSecondary}>
              Your streak grows every week you hit this. Rest days are built in. You can change it
              any time.
            </AppText>
            <View style={styles.goalRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGoal(n);
                  }}
                  style={[styles.goal, n === goal && styles.goalSelected]}>
                  <AppText variant="heading" color={n === goal ? '#000' : Colors.text}>
                    {n}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <AppText variant="heading" color={Colors.flame} style={{ textAlign: 'center' }}>
              {goal} day{goal === 1 ? '' : 's'} / week · {GOAL_HINTS[goal]}
            </AppText>
            <AppText variant="caption" style={{ textAlign: 'center' }}>
              A day counts when you log a workout of 15 minutes or more.
            </AppText>
          </View>
          <Button title="Continue" onPress={() => setStep('health')} />
        </>
      ) : (
        <>
          <View style={styles.body}>
            <AppText variant="label">Step 2 of 2</AppText>
            <View style={styles.healthIcon}>
              <SymbolView name="heart.fill" size={48} tintColor={Colors.ringMove} />
            </View>
            <AppText variant="title">Connect Apple Health</AppText>
            <AppText variant="body" color={Colors.textSecondary}>
              We read your workouts, steps, active calories, exercise minutes, and heart rate, so
              your streak updates automatically. There is nothing to log by hand.
            </AppText>
            <AppText variant="body" color={Colors.textSecondary}>
              We never write to Health, and your raw heart rate data stays private to you.
            </AppText>
          </View>
          <View style={{ gap: Spacing.sm }}>
            <Button title="Connect Apple Health" loading={saving} onPress={finish} />
            <Button title="Back" variant="secondary" disabled={saving} onPress={() => setStep('goal')} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  body: { flex: 1, justifyContent: 'center', gap: Spacing.md },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg },
  goal: {
    width: 44,
    height: 56,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalSelected: { backgroundColor: Colors.flame },
  healthIcon: {
    width: 88,
    height: 88,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
