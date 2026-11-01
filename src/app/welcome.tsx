import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascots';
import { SigamosName } from '@/components/sigamos-name';
import { AppText, Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/lib/auth';
import { MASCOT_KINDS, MASCOTS, mascotKind } from '@/lib/mascots';

type Page = { emoji?: string; title: string; body: string; points?: string[] };

const PAGES: Page[] = [
  {
    title: 'Welcome to Sigamos',
    body: 'Sigamos means “let’s keep going.” Keep a weekly workout streak alive with the people who keep you honest.',
  },
  {
    emoji: '🔥',
    title: 'Your weekly streak',
    body: 'Hit your days-a-week goal and the streak grows. You can change the goal any time on the Me tab.',
    points: [
      'A day counts when it has a workout of 15+ minutes',
      'Workouts sync from Apple Health, or log one with +',
      'Hit your goal to grow your streak; every 4 weeks earns a freeze',
      'Sick or traveling? Rest mode on the Me tab pauses it',
    ],
  },
  {
    emoji: '🤝',
    title: 'Better with partners',
    body: 'Invite friends or family with your code on the Partners tab.',
    points: [
      'See each other’s workouts and progress',
      'Cheer, verify check-in photos, comment, or send a voice message',
      'Nudge a partner who’s falling behind',
    ],
  },
  {
    emoji: '🎯',
    title: 'Challenges',
    body: 'Challenge a partner to a stretch goal with a real reward, like “4 workouts this week → coffee on me,” or take one on together.',
    points: [
      'Sigamos tracks it, and finishing is worth +100 XP',
      'XP from every workout moves you up the weekly league',
    ],
  },
  {
    emoji: '⚡',
    title: 'Earn XP, level up',
    body: 'Everything you do earns XP. It never resets, so your level only goes up: Rookie, Regular, Grinder, Iron, Machine, Legend.',
    points: [
      'Workouts earn 10–40 XP; add a photo for +25',
      'Hit your weekly goal: +50',
      'Partner verifies your workout: +5; you verify theirs: +2',
      'Finish a challenge: +100',
      'The weekly league starts over every Sunday',
    ],
  },
  {
    title: 'Pick your buddy',
    body: 'Your buddy’s mood follows your week. Choose Lotl, Capi, Lento, or Canela on the Me tab, and add the Sigamos widget to your Home Screen to keep them close.',
  },
];

/** A short tour for new people; Skip works on every page. Reopen it from the Me tab. */
export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const profile = useProfile();
  const mine = mascotKind(profile.mascot);
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const next = () => {
    Haptics.selectionAsync();
    if (last) return router.back();
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        {!last && (
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <AppText variant="heading" color={Colors.textSecondary}>
              Skip
            </AppText>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {PAGES.map((p, i) => (
          <ScrollView key={p.title} style={{ width }} contentContainerStyle={styles.page}>
            <View style={styles.art}>
              {i === 0 ? (
                <Mascot kind={mine} mood="happy" size={150} />
              ) : i === PAGES.length - 1 ? (
                <View style={styles.buddies}>
                  {MASCOT_KINDS.map((k) => (
                    <View key={k} style={{ alignItems: 'center' }}>
                      <Mascot kind={k} mood={k === mine ? 'blazing' : 'happy'} size={72} />
                      <AppText variant="caption">{MASCOTS[k].name}</AppText>
                    </View>
                  ))}
                </View>
              ) : (
                <AppText style={styles.emoji}>{p.emoji}</AppText>
              )}
            </View>
            {/* The first page teaches the name instead of a plain "Welcome to Sigamos". */}
            {i === 0 ? (
              <SigamosName />
            ) : (
              <AppText variant="title" style={styles.center}>
                {p.title}
              </AppText>
            )}
            <AppText variant="body" color={Colors.textSecondary} style={[styles.center, styles.body]}>
              {p.body}
            </AppText>
            {p.points && (
              <View style={styles.points}>
                {p.points.map((pt) => (
                  <View key={pt} style={styles.point}>
                    <View style={styles.dot} />
                    <AppText variant="body" style={{ flex: 1 }}>
                      {pt}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={[styles.pageDot, i === page && styles.pageDotOn]} />
          ))}
        </View>
        <Button title={last ? 'Let’s go' : 'Next'} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  top: { height: 44, paddingHorizontal: Spacing.lg, alignItems: 'flex-end', justifyContent: 'center' },
  page: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, alignItems: 'stretch' },
  art: { height: 200, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 96, lineHeight: 110 },
  buddies: { flexDirection: 'row', gap: Spacing.sm },
  center: { textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 24 },
  points: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
  },
  point: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.flame, marginTop: 8 },
  footer: { padding: Spacing.lg, gap: Spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  pageDotOn: { width: 20, backgroundColor: Colors.flame },
});
