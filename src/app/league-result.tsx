import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascots';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useLeagueResult, useLeagueResultTable, useMarkLeagueResultSeen } from '@/hooks/use-league';
import { useProfile } from '@/lib/auth';
import { MEDALS, resultLine, tierInfo } from '@/lib/leagues';
import { mascotKind } from '@/lib/mascots';

/** Rows shown around you in last week's table. */
const AROUND = 3;
const SPARKS = [
  { emoji: '✨', top: '8%', left: '12%', delay: 300 },
  { emoji: '🎉', top: '4%', left: '72%', delay: 450 },
  { emoji: '⭐', top: '26%', left: '84%', delay: 600 },
  { emoji: '✨', top: '30%', left: '6%', delay: 750 },
] as const;

/**
 * The start-of-week moment, Duolingo-style: first where you finished in last
 * week's group, then the tier you're in now, with your buddy cheering.
 */
export default function LeagueResultScreen() {
  const profile = useProfile();
  const { data: result } = useLeagueResult();
  const { data: table } = useLeagueResultTable(!!result);
  const seen = useMarkLeagueResultSeen();
  const [step, setStep] = useState<'table' | 'tier'>('table');

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [step]);

  const done = () => {
    seen.mutate();
    router.back();
  };

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.body} />
        <Button title="Continue" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const tier = tierInfo(result.tier);
  const buddy = mascotKind(profile.mascot);

  if (step === 'table') {
    const rows = table ?? [];
    const mine = rows.findIndex((r) => r.is_me);
    const shown = rows.slice(Math.max(0, mine - AROUND), mine + AROUND + 1);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.body}>
          <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.trophy}>
            <AppText style={styles.trophyEmoji}>{result.final_rank === 1 ? '🏆' : (MEDALS[result.final_rank - 1] ?? '🏅')}</AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150)}>
            <AppText style={styles.title}>
              {result.result === 'up' ? 'Congratulations! ' : ''}You finished #{result.final_rank} last week
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(300)} style={{ alignSelf: 'stretch' }}>
            <Card style={{ gap: 2, paddingHorizontal: Spacing.sm }}>
              {shown.map((r) => (
                <View key={r.member_key} style={[styles.row, r.is_me && styles.meRow]}>
                  <AppText style={[styles.rank, r.result === 'up' && { color: Colors.success }]}>
                    {r.xp > 0 && MEDALS[r.rank - 1] ? MEDALS[r.rank - 1] : r.rank}
                  </AppText>
                  <Mascot kind={mascotKind(r.mascot)} mood="happy" size={30} />
                  <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                    {r.is_me ? `${r.name} (you)` : r.name}
                  </AppText>
                  <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
                    {r.xp} XP
                  </AppText>
                </View>
              ))}
              {!shown.length && (
                <AppText variant="caption" style={{ textAlign: 'center', padding: Spacing.sm }}>
                  {result.final_xp} XP · #{result.final_rank} of {result.group_size}
                </AppText>
              )}
            </Card>
          </Animated.View>
        </View>
        <Animated.View entering={FadeInDown.delay(500)}>
          <Button title="Continue" onPress={() => setStep('tier')} />
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <View style={styles.stage}>
          {result.result === 'up' &&
            SPARKS.map((s, i) => (
              <Animated.Text
                key={i}
                entering={FadeIn.delay(s.delay).duration(400)}
                style={[styles.spark, { top: s.top, left: s.left }]}>
                {s.emoji}
              </Animated.Text>
            ))}
          <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.tierBurst}>
            <AppText style={styles.tierEmoji}>{tier.emoji}</AppText>
          </Animated.View>
        </View>
        <Animated.View entering={FadeInDown.delay(200)}>
          <AppText style={styles.title}>
            {result.result === 'up'
              ? `You moved up to the ${tier.name} League!`
              : result.result === 'down'
                ? `You’re in the ${tier.name} League this week`
                : `You stayed in the ${tier.name} League`}
          </AppText>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(400)} style={styles.buddyRow}>
          <Mascot
            kind={buddy}
            mood={result.result === 'up' ? 'blazing' : result.result === 'down' ? 'worried' : 'happy'}
            size={84}
          />
          <View style={styles.bubble}>
            <AppText variant="body">{resultLine(result.result, result.tier)}</AppText>
          </View>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(600)} style={{ gap: Spacing.sm }}>
        <Button title={result.result === 'down' ? 'Let’s go' : 'Continue'} loading={seen.isPending} onPress={done} />
        {result.result === 'up' && (
          <Button
            title="📤 Share"
            variant="secondary"
            onPress={() => {
              seen.mutate();
              router.replace({
                pathname: '/share',
                params: { kind: 'league', tier: String(result.tier), up: '1', rank: String(result.final_rank) },
              });
            }}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  trophy: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.xpSoft,
  },
  trophyEmoji: { fontSize: 64, lineHeight: 76 },
  title: {
    fontFamily: Font.rounded,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  meRow: { backgroundColor: Colors.flameSoft },
  rank: { width: 28, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '800', color: Colors.textSecondary },
  stage: { width: '100%', height: 220, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', fontSize: 30 },
  tierBurst: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.flameSoft,
    borderWidth: 3,
    borderColor: Colors.flame,
  },
  tierEmoji: { fontSize: 96, lineHeight: 112 },
  buddyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'stretch' },
  bubble: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
