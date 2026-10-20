import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascots';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequestPartner } from '@/hooks/use-social';
import { useAuth, useUpdateProfile } from '@/lib/auth';
import { healthAvailable, requestHealthPermissions } from '@/lib/health/healthkit';
import { INVITE_CODE_LENGTH, inviteMessage, normalizeInviteCode } from '@/lib/invite-link';
import type { LotlMood } from '@/lib/lotl';
import { MASCOTS, mascotKind, type MascotKind } from '@/lib/mascots';
import { clearPendingInvite, getPendingInvite } from '@/lib/pending-invite';
import { enablePush } from '@/lib/push';

const GOAL_HINTS: Record<number, string> = {
  1: 'Easing in',
  2: 'Building the habit',
  3: 'Solid and sustainable',
  4: 'Committed',
  5: 'Most weekdays',
  6: 'One rest day',
  7: 'Every single day',
};

type Step = 'name' | 'goal' | 'health' | 'notify' | 'partner';
/** Someone new only meets the buddy's friendly side; fired up, worried and sleepy are for later. */
type WelcomeMood = Extract<LotlMood, 'happy' | 'ready' | 'blazing'>;

/**
 * First-run setup, Duolingo style: a progress bar, the buddy talking on every
 * step, and it ends by inviting the person who'll keep you honest.
 */
export default function OnboardingScreen() {
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();
  // Apple sign-in fills the name; Google and email sign-ins ask for it.
  const [steps] = useState<Step[]>(() =>
    profile?.display_name?.trim()
      ? ['goal', 'health', 'notify', 'partner']
      : ['name', 'goal', 'health', 'notify', 'partner'],
  );
  const [index, setIndex] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [goal, setGoal] = useState(profile?.weekly_goal ?? 3);
  const [saving, setSaving] = useState(false);
  const step = steps[index]!;
  const buddy = mascotKind(profile?.mascot);
  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  const connectHealth = async () => {
    try {
      if (healthAvailable()) await requestHealthPermissions();
    } catch (e) {
      Alert.alert('Could not connect Apple Health', e instanceof Error ? e.message : String(e));
    }
    next();
  };

  // Save the name and goal before the partner step, so a request shows who sent it.
  const toPartnerStep = async (withNotifications: boolean) => {
    setSaving(true);
    // Notifications are optional; never block onboarding on them.
    if (withNotifications) await enablePush().catch(() => {});
    try {
      await updateProfile({
        ...(name.trim() ? { display_name: name.trim() } : {}),
        weekly_goal: goal,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      next();
    } catch (e) {
      Alert.alert('Could not save your setup', e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  const finish = async () => {
    setSaving(true);
    try {
      await clearPendingInvite();
      await updateProfile({ onboarded_at: new Date().toISOString() });
      // The root navigator switches to the tabs once onboarded_at is set.
    } catch (e) {
      Alert.alert('Could not finish setup', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <Pressable
            onPress={back}
            disabled={index === 0}
            hitSlop={12}
            accessibilityLabel="Back"
            style={{ opacity: index === 0 ? 0 : 1 }}>
            <SymbolView name="chevron.left" size={20} tintColor={Colors.textSecondary} />
          </Pressable>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: steps.length, now: index + 1 }}>
            <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
          </View>
        </View>

        {step === 'name' ? (
          <StepLayout
            buddy={buddy}
            mood="happy"
            says={`Hi, I’m ${MASCOTS[buddy].name}! What should your partners call you?`}
            footer={<Button title="Continue" disabled={!name.trim()} onPress={next} />}>
            <TextInput
              style={styles.nameInput}
              placeholder="First name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              autoFocus
              maxLength={40}
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => name.trim() && next()}
            />
          </StepLayout>
        ) : step === 'goal' ? (
          <StepLayout
            buddy={buddy}
            mood="ready"
            says="How many days a week do you want to move?"
            footer={<Button title="I’m committed" onPress={next} />}>
            <View style={styles.goalRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <Pressable
                  key={n}
                  accessibilityLabel={`${n} day${n === 1 ? '' : 's'} a week`}
                  accessibilityState={{ selected: n === goal }}
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
            <AppText variant="heading" color={Colors.flame} style={styles.center}>
              {goal} day{goal === 1 ? '' : 's'} / week · {GOAL_HINTS[goal]}
            </AppText>
            <AppText variant="caption" style={styles.center}>
              Hit it and your streak grows a week. A day counts when you work out 15 minutes or
              more. You can change this any time.
            </AppText>
          </StepLayout>
        ) : step === 'health' ? (
          <StepLayout
            buddy={buddy}
            mood="happy"
            says="I’ll count your workouts from Apple Health, so there’s nothing to log."
            footer={
              <>
                <Button title="Connect Apple Health" onPress={connectHealth} />
                <Button title="Not now" variant="secondary" onPress={next} />
              </>
            }>
            <Card style={styles.infoCard}>
              <SymbolView name="heart.fill" size={28} tintColor={Colors.ringMove} />
              <AppText variant="body" color={Colors.textSecondary} style={styles.flex}>
                We read workouts, steps, active calories, exercise minutes, and heart rate. We never
                write to Health, and your raw heart rate stays private to you.
              </AppText>
            </Card>
            <AppText variant="caption" style={styles.center}>
              Without it, log workouts by hand with the + button.
            </AppText>
          </StepLayout>
        ) : step === 'notify' ? (
          <StepLayout
            buddy={buddy}
            mood="ready"
            says="Want a ping when your partner works out or nudges you?"
            footer={
              <>
                <Button title="Turn on notifications" loading={saving} onPress={() => toPartnerStep(true)} />
                <Button
                  title="Not now"
                  variant="secondary"
                  disabled={saving}
                  onPress={() => toPartnerStep(false)}
                />
              </>
            }>
            <Card style={styles.infoCard}>
              <SymbolView name="bell.badge.fill" size={28} tintColor={Colors.flame} />
              <AppText variant="body" color={Colors.textSecondary} style={styles.flex}>
                Partner workouts, nudges, and a heads-up when your streak is on the line. Fine-tune
                each one on the Me tab.
              </AppText>
            </Card>
          </StepLayout>
        ) : (
          <PartnerStep buddy={buddy} saving={saving} onFinish={finish} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Last step: accept the invite that brought them here, or invite their person. */
function PartnerStep({
  buddy,
  saving,
  onFinish,
}: {
  buddy: MascotKind;
  saving: boolean;
  onFinish: () => void;
}) {
  const { profile } = useAuth();
  const request = useRequestPartner();
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [shared, setShared] = useState(false);

  useEffect(() => {
    getPendingInvite().then(setPending);
  }, []);

  const send = (raw: string) => {
    const normalized = normalizeInviteCode(raw);
    if (!normalized) return;
    request.mutate(normalized, {
      onError: (e) => Alert.alert('Could not add partner', e instanceof Error ? e.message : String(e)),
    });
  };

  const share = async () => {
    if (!profile) return;
    const result = await Share.share({ message: inviteMessage(profile.invite_code) });
    if (result.action === Share.sharedAction) setShared(true);
  };

  const done = request.isSuccess || shared;

  return (
    <StepLayout
      buddy={buddy}
      mood={done ? 'blazing' : 'ready'}
      says={
        request.data?.status === 'accepted'
          ? 'You’re partners! Let’s keep each other going.'
          : done
            ? 'Nice. I’ll let you know when they join.'
            : 'Streaks are easier with someone who keeps you honest. Who’s your person?'
      }
      footer={
        <Button
          title={done ? 'Let’s go' : 'I’ll do this later'}
          variant={done ? 'primary' : 'secondary'}
          loading={saving}
          onPress={onFinish}
        />
      }>
      {request.isSuccess ? (
        <Card style={styles.infoCard}>
          <AppText variant="display">🤝</AppText>
          <AppText variant="body" color={Colors.textSecondary} style={styles.flex}>
            {request.data?.status === 'accepted'
              ? 'You can now see each other’s workouts and streaks.'
              : 'Request sent. They’ll show up in your partners once they accept.'}
          </AppText>
        </Card>
      ) : pending ? (
        <Card style={styles.codeCard}>
          <AppText variant="label">You were invited</AppText>
          <AppText variant="display" style={styles.code}>
            {pending}
          </AppText>
          <Button title="Accept invite" loading={request.isPending} onPress={() => send(pending)} />
        </Card>
      ) : (
        <>
          <Card style={styles.codeCard}>
            <AppText variant="label">Your invite code</AppText>
            <AppText variant="display" style={styles.code} selectable>
              {profile?.invite_code}
            </AppText>
            <Button title={shared ? 'Invite shared ✓' : 'Share invite'} onPress={share} />
          </Card>
          <Card style={{ gap: Spacing.sm }}>
            <AppText variant="label">Have someone’s code?</AppText>
            <View style={styles.codeRow}>
              <TextInput
                style={styles.codeInput}
                placeholder="ABCD23"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={INVITE_CODE_LENGTH}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
              />
              <Button
                title="Send"
                variant="secondary"
                disabled={!normalizeInviteCode(code)}
                loading={request.isPending}
                onPress={() => send(code)}
              />
            </View>
          </Card>
        </>
      )}
    </StepLayout>
  );
}

function StepLayout({
  buddy,
  mood,
  says,
  footer,
  children,
}: {
  buddy: MascotKind;
  mood: WelcomeMood;
  says: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.speech}>
          <Mascot kind={buddy} mood={mood} size={84} />
          <View style={styles.bubble}>
            <AppText variant="heading">{says}</AppText>
          </View>
        </View>
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: Colors.flame },
  body: { flexGrow: 1, justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  speech: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bubble: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  footer: { gap: Spacing.sm, paddingVertical: Spacing.md },
  nameInput: {
    height: 56,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    fontSize: 20,
    fontWeight: '600',
  },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between' },
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
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  codeCard: { alignItems: 'stretch', gap: Spacing.md },
  code: { textAlign: 'center', letterSpacing: 8, fontSize: 40, color: Colors.flame },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  codeInput: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.cardRaised,
    color: Colors.text,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 6,
    fontWeight: '700',
  },
});
