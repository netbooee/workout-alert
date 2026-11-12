import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Mascot } from '@/components/mascots';
import { Colors } from '@/constants/theme';
import type { LotlMood } from '@/lib/lotl';
import { MASCOTS, mascotKind } from '@/lib/mascots';

/** Someone's buddy in a round chip, for chat bubbles and small lists. */
export function BuddyChip({
  mascot,
  size = 30,
  mood = 'happy',
}: {
  mascot: string | null | undefined;
  size?: number;
  mood?: LotlMood;
}) {
  const kind = mascotKind(mascot);
  return (
    <View
      accessible
      accessibilityLabel={MASCOTS[kind].name}
      style={[styles.chip, { width: size, height: size, borderRadius: size / 2 }]}>
      <Mascot kind={kind} mood={mood} size={size * 0.9} />
    </View>
  );
}

/** A profile photo with the person's buddy peeking from the corner. */
export function AvatarWithBuddy({
  id,
  name,
  photoPath,
  mascot,
  size = 36,
}: {
  id: string;
  name: string | null;
  photoPath?: string | null;
  mascot: string | null | undefined;
  size?: number;
}) {
  const badge = Math.round(size * 0.58);
  return (
    <View style={{ width: size, height: size }}>
      <Avatar id={id} name={name} size={size} photoPath={photoPath} />
      <View style={[styles.badge, { right: -badge * 0.28, bottom: -badge * 0.18, borderRadius: badge / 2 + 2 }]}>
        <BuddyChip mascot={mascot} size={badge} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: Colors.cardRaised },
  badge: { position: 'absolute', padding: 2, backgroundColor: Colors.card },
});
