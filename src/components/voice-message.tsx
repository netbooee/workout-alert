import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatClip } from '@/lib/voice';

/** A play/pause pill with progress for a voice message (remote signed URL or local file). */
export function VoiceMessage({ url, durationMs }: { url: string | undefined; durationMs: number }) {
  const player = useAudioPlayer(url ?? null);
  const status = useAudioPlayerStatus(player);
  const duration = status.duration > 0 ? status.duration : durationMs / 1000;
  const atEnd = status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.05);
  const progress = duration > 0 && !atEnd ? Math.min(status.currentTime / duration, 1) : 0;

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (atEnd) await player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.pill}>
      <Pressable
        onPress={toggle}
        disabled={!url}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
        style={styles.button}>
        {!url ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={14} tintColor="#000" />
        )}
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <AppText variant="caption" style={styles.time}>
        {formatClip((status.playing || progress > 0 ? status.currentTime : duration) * 1000)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardRaised,
    borderRadius: Radius.pill,
    padding: 4,
    paddingRight: Spacing.md,
    alignSelf: 'stretch',
  },
  button: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.flame },
  time: { fontVariant: ['tabular-nums'], minWidth: 32, textAlign: 'right' },
});
