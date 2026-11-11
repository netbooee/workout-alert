import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReactionBar } from '@/components/reaction-bar';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCheerQueue, useNames, usePartnerFeed, type FeedItem } from '@/hooks/use-social';
import { whenLabel } from '@/lib/cheers';
import { useEvidenceUrls } from '@/lib/evidence';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';
import { isVerified, workoutXp } from '@/lib/workout-xp';
import { treats } from '@/lib/treats';

/**
 * Partners' newest workouts on the Partners tab, one row each with Cheer and
 * Verify, and how many are still waiting on you. See all opens the full feed.
 */
export function ActivityCard({ count }: { count: number }) {
  const feed = usePartnerFeed();
  const toCheer = useCheerQueue().length;
  const items = feed.data ?? [];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="label" style={{ flex: 1 }}>
          Activity
        </AppText>
        {toCheer > 0 && (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{toCheer} to cheer</AppText>
          </View>
        )}
        {items.length > count && (
          <Pressable onPress={() => router.push('/activity')} hitSlop={10} accessibilityRole="button">
            <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
              See all ›
            </AppText>
          </Pressable>
        )}
      </View>
      {feed.isSuccess && items.length === 0 ? (
        <AppText variant="caption" style={{ paddingBottom: Spacing.sm }}>
          When your partners work out, it shows up here so you can cheer them on.
        </AppText>
      ) : (
        <FeedRows items={items.slice(0, count)} />
      )}
    </Card>
  );
}

/** Feed items as one-line rows with hairlines between them. */
export function FeedRows({ items }: { items: FeedItem[] }) {
  const nameOf = useNames();
  return (
    <>
      {items.map((item, i) => (
        <Fragment key={item.workout.id}>
          {i > 0 && <View style={styles.divider} />}
          <FeedRow item={item} name={nameOf(item.workout.user_id)} />
        </Fragment>
      ))}
    </>
  );
}

const THUMB = 42;

function FeedRow({ item, name }: { item: FeedItem; name: string }) {
  const w = item.workout;
  const { data: urls } = useEvidenceUrls(w.photo_paths.slice(0, 1));
  const photo = w.photo_paths[0] ? urls?.[w.photo_paths[0]] : undefined;
  const xp = workoutXp({
    durationS: w.duration_s,
    counted: w.counted,
    hasPhoto: w.photo_paths.length > 0,
    verified: isVerified(w.user_id, item.reactions),
  }).earned;
  const first = name.split(' ')[0];
  const meta = [
    formatDuration(w.duration_s),
    whenLabel(w.started_at).split(' ')[0],
    w.photo_paths.length ? `${w.photo_paths.length} photo${w.photo_paths.length === 1 ? '' : 's'}` : null,
    xp > 0 ? treats(xp) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${first}, ${workoutLabel(w.activity_type)}, ${meta}`}
        style={({ pressed }) => [styles.who, pressed && { opacity: 0.6 }]}>
        <View style={[styles.thumb, !photo && styles.iconTile]}>
          {photo ? (
            <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <SymbolView name={workoutIcon(w.activity_type)} size={20} tintColor={Colors.flame} />
          )}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <AppText style={styles.title} numberOfLines={1}>
            {first} · {workoutLabel(w.activity_type)}
          </AppText>
          <AppText variant="caption" numberOfLines={1} style={{ fontSize: 12 }}>
            {meta}
          </AppText>
        </View>
      </Pressable>
      <ReactionBar workoutId={w.id} ownerId={w.user_id} reactions={item.reactions} round />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: Spacing.sm + 4, paddingBottom: Spacing.xs, gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Colors.flameSoft },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: Colors.flame },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: THUMB + Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 62 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 56 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  iconTile: { backgroundColor: Colors.flameSoft },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: Colors.text },
});
