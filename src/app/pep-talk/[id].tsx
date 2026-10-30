import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { AppText, Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePartners } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { useMarkPepTalksSeen, usePepTalk, usePepTalkMediaUrl } from '@/lib/pep-talks';
import { playSound } from '@/lib/sounds';

/**
 * A pep talk, full screen: the photo or video (looping, with sound), who sent
 * it and their line, then "Thanks!" or "Send one back".
 */
export default function PepTalkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth().profile?.id;
  const { data: pepTalk, isPending } = usePepTalk(id);
  const { data: url } = usePepTalkMediaUrl(pepTalk?.media_path);
  const { data: partners } = usePartners();
  // react-query keeps mutate stable, so it's safe in the effect below.
  const { mutate: markSeen } = useMarkPepTalksSeen();
  const received = !!pepTalk && pepTalk.to_id === me;
  const otherId = pepTalk ? (received ? pepTalk.from_id : pepTalk.to_id) : null;
  const other = partners?.find((p) => p.partner_id === otherId);
  const otherName = other?.display_name?.split(' ')[0] ?? 'Your partner';
  const unseenId = received && !pepTalk.seen_at ? pepTalk.id : null;

  useEffect(() => {
    if (!unseenId) return;
    playSound('banner');
    markSeen([unseenId]);
  }, [unseenId, markSeen]);

  return (
    <View style={styles.container}>
      {pepTalk && url ? (
        pepTalk.media_kind === 'photo' ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <Playback url={url} />
        )
      ) : (
        <View style={styles.loading}>
          {isPending || (pepTalk && !url) ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText variant="body" color="#fff">
              This pep talk isn’t available anymore.
            </AppText>
          )}
        </View>
      )}

      {/* Darkens the top and bottom so the text stays readable over any photo. */}
      <View style={[styles.shade, styles.shadeTop]} pointerEvents="none" />
      <View style={[styles.shade, styles.shadeBottom]} pointerEvents="none" />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          {otherId && <Avatar id={otherId} name={other?.display_name ?? null} size={36} />}
          <AppText variant="heading" color="#fff" style={{ flex: 1 }} numberOfLines={1}>
            {pepTalk ? (received ? `${otherName} sent you a pep talk` : `Your pep talk for ${otherName}`) : ''}
          </AppText>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={styles.close}>
            <SymbolView name="xmark" size={14} weight="bold" tintColor="#fff" />
          </Pressable>
        </View>

        <View style={styles.bottom}>
          {pepTalk?.message ? (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.bubble}>
              <AppText variant="heading" style={{ fontSize: 20, lineHeight: 26 }}>
                “{pepTalk.message}”
              </AppText>
            </Animated.View>
          ) : null}
          {received ? (
            <Animated.View entering={FadeInDown.delay(500)} style={{ gap: Spacing.sm }}>
              <Button
                title="Thanks! 💪"
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  router.back();
                }}
              />
              <Button
                title="📣 Send one back"
                variant="secondary"
                onPress={() => router.replace({ pathname: '/pep-talk/new', params: { to: pepTalk.from_id } })}
              />
            </Animated.View>
          ) : (
            pepTalk && (
              <AppText variant="caption" color="#fff" style={{ textAlign: 'center' }}>
                {pepTalk.seen_at ? `${otherName} saw it 👀` : `${otherName} hasn’t opened it yet`}
              </AppText>
            )
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Playback({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  shade: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  shadeTop: { top: 0, height: 140 },
  shadeBottom: { bottom: 0, height: 260 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'space-between', padding: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  bottom: { gap: Spacing.md },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
  },
});
