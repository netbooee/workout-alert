import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Mascot } from '@/components/mascots';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useDismissNewCheers, useNewCheers, usePartners } from '@/hooks/use-social';
import { cheerBanner } from '@/lib/cheer-banner';
import { mascotKind } from '@/lib/mascots';
import { playSound } from '@/lib/sounds';

const SHOW_MS = 8000;

/**
 * "Tony 🔥 cheered your strength" (after Future Pro): a small card that slides
 * in on Home when partners cheered or verified your workouts since you last
 * looked. Tap to open the workout; it hides itself after a few seconds.
 */
export function CheerBanner() {
  const { data: items } = useNewCheers();
  const { data: partners } = usePartners();
  const dismiss = useDismissNewCheers();
  const newest = items?.[0]?.created_at;

  useEffect(() => {
    if (!newest) return;
    playSound('banner');
    const id = setTimeout(() => dismiss(newest), SHOW_MS);
    return () => clearTimeout(id);
  }, [newest, dismiss]);

  const firstName = (id: string) =>
    partners?.find((p) => p.partner_id === id)?.display_name?.split(' ')[0] ?? 'A partner';
  const banner = cheerBanner(items ?? [], firstName);
  if (!banner) return null;
  const buddy = partners?.find((p) => p.partner_id === banner.who)?.mascot;

  return (
    <Animated.View entering={FadeInUp.springify().damping(14)} exiting={FadeOutUp}>
      <Pressable
        onPress={() => {
          dismiss(newest);
          if (banner.workoutId) router.push({ pathname: '/workout/[id]', params: { id: banner.workoutId } });
        }}
        accessibilityRole="button"
        accessibilityLabel={banner.text}
        style={styles.card}>
        <View style={styles.buddy}>
          <Mascot kind={mascotKind(buddy)} mood="happy" size={36} />
        </View>
        <AppText variant="heading" style={{ flex: 1, fontSize: 15 }} numberOfLines={2}>
          {banner.text}
        </AppText>
        <Pressable onPress={() => dismiss(newest)} hitSlop={12} accessibilityLabel="Dismiss">
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
    padding: Spacing.sm + 2,
    paddingRight: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.success,
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  },
  buddy: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.xpSoft,
  },
});
