import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { PhotoViewer } from '@/components/photo-viewer';
import { ReactionBar } from '@/components/reaction-bar';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FeedItem } from '@/hooks/use-social';
import { whenLabel } from '@/lib/cheers';
import { useEvidenceUrls } from '@/lib/evidence';
import { evidenceBadges } from '@/lib/evidence-badges';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';

const THUMB = 72;

/**
 * One partner workout in the feed. Every card has the same shape: a square on
 * the left (the photo's thumbnail, or the workout's icon), three single lines of
 * text, then Cheer and Verify. Tap the thumbnail for the full-size photos; tap
 * the text for the workout.
 */
export function FeedCard({ item, name }: { item: FeedItem; name: string }) {
  const w = item.workout;
  const { data: urls } = useEvidenceUrls(w.photo_paths);
  const photos = w.photo_paths.map((p) => urls?.[p]).filter((u): u is string => !!u);
  const [viewing, setViewing] = useState<number | null>(null);
  const evidence = evidenceBadges(w, item.alsoRecordedBy)[0]!;

  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={styles.row}>
        {w.photo_paths.length ? (
          <Pressable
            onPress={() => photos.length && setViewing(0)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open ${w.photo_paths.length} photo${w.photo_paths.length === 1 ? '' : 's'}`}
            style={styles.thumb}>
            {photos[0] ? (
              <Image source={photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : null}
            {w.photo_paths.length > 1 && (
              <View style={styles.more}>
                <AppText variant="caption" color="#fff" style={{ fontWeight: '700', fontSize: 11 }}>
                  +{w.photo_paths.length - 1}
                </AppText>
              </View>
            )}
          </Pressable>
        ) : (
          <View style={[styles.thumb, styles.iconTile]}>
            <SymbolView name={workoutIcon(w.activity_type)} size={28} tintColor={Colors.flame} />
          </View>
        )}

        <Link href={{ pathname: '/workout/[id]', params: { id: w.id } }} asChild>
          <Pressable style={styles.text} accessibilityRole="button">
            <View style={styles.nameRow}>
              <Avatar id={w.user_id} name={name} size={20} />
              <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                {name.split(' ')[0]} · {workoutLabel(w.activity_type)}
              </AppText>
            </View>
            <AppText variant="caption" numberOfLines={1}>
              {formatDuration(w.duration_s)}
              {w.avg_hr != null ? ` · ${Math.round(w.avg_hr)} bpm` : ''} · {whenLabel(w.started_at)}
            </AppText>
            <AppText variant="caption" numberOfLines={1} color={w.note ? Colors.text : Colors.textMuted}>
              {w.note ?? evidence.label}
            </AppText>
          </Pressable>
        </Link>
      </View>

      <ReactionBar workoutId={w.id} ownerId={w.user_id} reactions={item.reactions} compact />
      <PhotoViewer urls={photos} index={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.cardRaised,
  },
  iconTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.flameSoft },
  more: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  text: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
