import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Mascot } from '@/components/mascots';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePartners } from '@/hooks/use-social';
import { mascotKind } from '@/lib/mascots';
import { useMarkPepTalksSeen, useNewPepTalks } from '@/lib/pep-talks';
import { playSound } from '@/lib/sounds';

/**
 * "Tony sent you a pep talk 📣" on Home until you open it. Unlike the cheer
 * banner it stays put: someone made this for you. ✕ dismisses it.
 */
export function PepTalkBanner() {
  const { data: pepTalks } = useNewPepTalks();
  const { data: partners } = usePartners();
  const { mutate: markSeen } = useMarkPepTalksSeen();
  const newest = pepTalks?.[0];

  useEffect(() => {
    if (newest?.id) playSound('banner');
  }, [newest?.id]);

  if (!newest) return null;
  const sender = partners?.find((p) => p.partner_id === newest.from_id);
  const name = sender?.display_name?.split(' ')[0] ?? 'A partner';
  const more = (pepTalks?.length ?? 1) - 1;

  return (
    <Animated.View entering={FadeInUp.springify().damping(14)} exiting={FadeOutUp}>
      <Pressable
        onPress={() => router.push({ pathname: '/pep-talk/[id]', params: { id: newest.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${name} sent you a pep talk. Opens it.`}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
        <View style={styles.buddy}>
          <Mascot kind={mascotKind(sender?.mascot)} mood="fired_up" size={40} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" style={{ fontSize: 15 }} numberOfLines={1}>
            {name} sent you a pep talk 📣
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {newest.message
              ? `“${newest.message}”`
              : newest.media_kind === 'video'
                ? 'Tap to watch it'
                : 'Tap to see it'}
            {more > 0 ? ` · +${more} more` : ''}
          </AppText>
        </View>
        <Pressable
          onPress={() => markSeen(pepTalks!.map((p) => p.id))}
          hitSlop={12}
          accessibilityLabel="Dismiss">
          <SymbolView name="xmark" size={12} weight="bold" tintColor={Colors.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 4,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Colors.flame,
    backgroundColor: Colors.flameSoft,
  },
  buddy: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
});
