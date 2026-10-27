import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, PixelRatio, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascots';
import { AppText, Button } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import { useHomeData } from '@/hooks/use-home-data';
import { useWorkout } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { useEvidenceUrls } from '@/lib/evidence';
import { tierInfo } from '@/lib/leagues';
import type { LotlMood } from '@/lib/lotl';
import { mascotKind } from '@/lib/mascots';
import { cardHeadline, shareCaption, type ShareCard } from '@/lib/share-card';
import { workoutLabel } from '@/lib/workout-types';
import { isVerified, workoutXp } from '@/lib/workout-xp';

/** Story-shaped, exported at 1080 × 1920. */
const RATIO = 16 / 9;
const EXPORT_WIDTH = 1080;

/**
 * A share card for Instagram Stories, Messages and the rest of the share sheet:
 * a workout, a streak milestone or a league move, with your buddy and your
 * invite link. Only your own numbers, never a partner's.
 *
 * Params: kind=workout&id=… | kind=streak&weeks=… | kind=league&tier=…&up=1&rank=…
 */
export default function ShareScreen() {
  const params = useLocalSearchParams<{ kind: string; id?: string; weeks?: string; tier?: string; up?: string; rank?: string }>();
  const profile = useProfile();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const ref = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const { data: home } = useHomeData();
  const { data: item } = useWorkout(params.kind === 'workout' ? (params.id ?? '') : '');
  const photoPath = params.kind === 'workout' ? item?.workout.photo_paths[0] : undefined;
  const { data: urls } = useEvidenceUrls(photoPath ? [photoPath] : []);
  const photo = photoPath ? urls?.[photoPath] : undefined;
  const streakWeeks = home?.streak?.current_weeks ?? 0;

  const card: ShareCard | null =
    params.kind === 'workout'
      ? item
        ? {
            kind: 'workout',
            label: workoutLabel(item.workout.activity_type),
            minutes: Math.round(item.workout.duration_s / 60),
            xp: workoutXp({
              durationS: item.workout.duration_s,
              counted: item.workout.counted,
              hasPhoto: item.workout.photo_paths.length > 0,
              verified: isVerified(item.workout.user_id, item.reactions),
            }).earned,
            streakWeeks,
          }
        : null
      : params.kind === 'streak'
        ? { kind: 'streak', weeks: Number(params.weeks) || streakWeeks }
        : { kind: 'league', tier: Number(params.tier) || 1, movedUp: params.up === '1', rank: Number(params.rank) || undefined };

  // Fit the preview between the header and the buttons.
  const width = Math.min(screenWidth - Spacing.lg * 2, (screenHeight - 260) / RATIO);

  const share = async () => {
    if (!card || !ref.current) return;
    setSharing(true);
    try {
      const px = EXPORT_WIDTH / PixelRatio.get();
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: px, height: px * RATIO });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Share.share({ url: uri, message: shareCaption(card, profile.invite_code) });
    } catch (e) {
      Alert.alert('Could not share', friendlyError(e));
    }
    setSharing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AppText variant="heading">Share</AppText>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <AppText variant="heading" color={Colors.flame}>
            Done
          </AppText>
        </Pressable>
      </View>
      <View style={styles.stage}>
        {card ? (
          <View ref={ref} collapsable={false} style={{ width, height: width * RATIO }}>
            <CardArt card={card} width={width} photo={photo} inviteCode={profile.invite_code} buddy={mascotKind(profile.mascot)} />
          </View>
        ) : (
          <AppText variant="caption">Loading…</AppText>
        )}
      </View>
      <Button title="Share" loading={sharing} disabled={!card} onPress={share} />
      <AppText variant="caption" style={{ textAlign: 'center', marginTop: Spacing.sm }}>
        Only your own numbers are shown. Your invite link is included.
      </AppText>
    </SafeAreaView>
  );
}

/** The card itself. Fixed colours so it looks the same in light and dark mode. */
function CardArt({
  card,
  width,
  photo,
  inviteCode,
  buddy,
}: {
  card: ShareCard;
  width: number;
  photo?: string;
  inviteCode: string | null;
  buddy: ReturnType<typeof mascotKind>;
}) {
  const s = width / 360;
  const t = (size: number, extra?: object) => ({
    fontSize: size * s,
    lineHeight: size * s * 1.2,
    color: '#fff',
    fontFamily: Font.rounded,
    fontWeight: '800' as const,
    ...extra,
  });
  const mood: LotlMood = card.kind === 'league' && !card.movedUp ? 'happy' : 'blazing';
  const big =
    card.kind === 'streak' ? '🔥' : card.kind === 'league' ? tierInfo(card.tier).emoji : null;

  return (
    <View style={[styles.card, { borderRadius: 28 * s }]}>
      {photo ? (
        <>
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
        </>
      ) : (
        <>
          <View style={[styles.glow, { width: 420 * s, height: 420 * s, borderRadius: 210 * s, top: -120 * s, right: -160 * s }]} />
          <View style={[styles.glow, { width: 300 * s, height: 300 * s, borderRadius: 150 * s, bottom: 40 * s, left: -140 * s }]} />
        </>
      )}

      <View style={[styles.brand, { margin: 22 * s, gap: 8 * s }]}>
        <Image source={require('@/assets/images/icon.png')} style={{ width: 30 * s, height: 30 * s, borderRadius: 8 * s }} />
        <Text style={t(20)}>Sigamos</Text>
      </View>

      <View style={[styles.middle, { paddingHorizontal: 24 * s, gap: 6 * s }]}>
        {big && <Text style={{ fontSize: 120 * s, lineHeight: 140 * s, textAlign: 'center' }}>{big}</Text>}
        {card.kind === 'streak' && <Text style={t(96, { textAlign: 'center' })}>{card.weeks}</Text>}
        <Text style={t(card.kind === 'streak' ? 30 : 40, { textAlign: card.kind === 'workout' ? 'left' : 'center' })}>
          {card.kind === 'streak' ? 'week streak' : cardHeadline(card)}
        </Text>
        {card.kind === 'workout' && (
          <View style={{ gap: 10 * s }}>
            <Text style={t(26)}>{card.minutes} min</Text>
            <View style={[styles.chips, { gap: 8 * s }]}>
              {card.xp > 0 && <Chip s={s} text={`⚡ ${card.xp} XP`} />}
              {card.streakWeeks > 0 && <Chip s={s} text={`🔥 ${card.streakWeeks}-week streak`} />}
            </View>
          </View>
        )}
        {card.kind === 'league' && card.rank ? (
          <Text style={t(22, { textAlign: 'center', fontWeight: '700' })}>#{card.rank} this week</Text>
        ) : null}
      </View>

      <View style={[styles.footer, { padding: 22 * s, gap: 10 * s }]}>
        <View style={{ flex: 1, gap: 2 * s }}>
          <Text style={t(20)}>Join me on Sigamos</Text>
          {inviteCode && <Text style={t(13, { fontWeight: '600', opacity: 0.9 })}>sigamos.cloud/invite/{inviteCode}</Text>}
        </View>
        <Mascot kind={buddy} mood={mood} size={96 * s} />
      </View>
    </View>
  );
}

function Chip({ s, text }: { s: number; text: string }) {
  return (
    <View style={{ paddingHorizontal: 12 * s, paddingVertical: 6 * s, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <Text style={{ color: '#fff', fontSize: 17 * s, lineHeight: 21 * s, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: Spacing.md },
  card: { flex: 1, overflow: 'hidden', backgroundColor: '#FF6B1A', justifyContent: 'space-between' },
  glow: { position: 'absolute', backgroundColor: 'rgba(255, 214, 10, 0.35)' },
  brand: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' },
});
