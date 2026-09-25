import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EvidenceBadges } from '@/components/evidence-badges';
import { ReactionBar } from '@/components/reaction-bar';
import { AppText, Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { FeedItem } from '@/hooks/use-social';
import { useEvidenceUrls } from '@/lib/evidence';
import { formatDuration, workoutLabel } from '@/lib/workout-types';

export function FeedCard({ item, name }: { item: FeedItem; name: string }) {
  const w = item.workout;
  const { data: urls } = useEvidenceUrls(w.photo_paths.slice(0, 1));
  const cover = urls?.[w.photo_paths[0]!];
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
          {cover ? <Image source={cover} style={styles.photo} contentFit="cover" transition={150} /> : null}
          <EvidenceBadges workout={w} />
        </Pressable>
      </Link>
      <ReactionBar workoutId={w.id} ownerId={w.user_id} reactions={item.reactions} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md },
});
