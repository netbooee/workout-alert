import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EvidenceBadges } from '@/components/evidence-badges';
import { PhotoViewer } from '@/components/photo-viewer';
import { ReactionBar } from '@/components/reaction-bar';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FeedItem } from '@/hooks/use-social';
import { useEvidenceUrls } from '@/lib/evidence';
import { formatDuration, workoutLabel } from '@/lib/workout-types';

export function FeedCard({ item, name }: { item: FeedItem; name: string }) {
  const w = item.workout;
  const { data: urls } = useEvidenceUrls(w.photo_paths);
  const photos = w.photo_paths.map((p) => urls?.[p]).filter((u): u is string => !!u);
  const cover = photos[0];
  // Show the photo at its own shape (within reason) instead of cropping it to 4:3.
  const [aspect, setAspect] = useState(4 / 3);
  const [viewing, setViewing] = useState<number | null>(null);
  const when = new Date(w.started_at);

  return (
    <Card style={{ gap: Spacing.md }}>
      <Link href={{ pathname: '/workout/[id]', params: { id: w.id } }} asChild>
        <Pressable style={{ gap: Spacing.md }}>
          <View style={styles.header}>
            <Avatar id={w.user_id} name={name} size={36} />
            <View style={{ flex: 1 }}>
              <AppText variant="heading">
                {name} · {workoutLabel(w.activity_type)}
              </AppText>
              <AppText variant="caption">
                {formatDuration(w.duration_s)}
                {w.avg_hr != null ? ` · ${Math.round(w.avg_hr)} bpm` : ''} ·{' '}
                {when.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </AppText>
            </View>
          </View>
          {w.note ? <AppText variant="body">{w.note}</AppText> : null}
        </Pressable>
      </Link>
      {cover ? (
        <Pressable onPress={() => setViewing(0)} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
          <Image
            source={cover}
            style={[styles.photo, { aspectRatio: aspect }]}
            contentFit="cover"
            transition={150}
            onLoad={(e) => setAspect(Math.min(Math.max(e.source.width / e.source.height, 3 / 4), 16 / 9))}
          />
          {photos.length > 1 && (
            <View style={styles.more}>
              <AppText variant="caption" color="#fff" style={{ fontWeight: '700' }}>
                +{photos.length - 1}
              </AppText>
            </View>
          )}
        </Pressable>
      ) : null}
      <Link href={{ pathname: '/workout/[id]', params: { id: w.id } }} asChild>
        <Pressable>
          <EvidenceBadges workout={w} />
        </Pressable>
      </Link>
      <ReactionBar workoutId={w.id} ownerId={w.user_id} reactions={item.reactions} />
      <PhotoViewer urls={photos} index={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photo: { width: '100%', borderRadius: Radius.md, backgroundColor: Colors.cardRaised },
  more: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
