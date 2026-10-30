import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Mascot } from '@/components/mascots';
import { AppText, Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePartners } from '@/hooks/use-social';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { friendlyError } from '@/lib/errors';
import { mascotKind } from '@/lib/mascots';
import {
  capturePepTalk,
  PEP_TALK_MAX_SECONDS,
  PEP_TALK_MESSAGE_MAX,
  useSendPepTalk,
  type Capture,
} from '@/lib/pep-talks';

/**
 * Send a partner a pep talk: take a photo or record a video (up to 30
 * seconds) with the camera, add a line if you like, and send.
 */
export default function NewPepTalkScreen() {
  const { to } = useLocalSearchParams<{ to: string }>();
  const { data: partners } = usePartners();
  const partner = partners?.find((p) => p.partner_id === to);
  const firstName = partner?.display_name?.split(' ')[0] ?? 'your partner';
  const [capture, setCapture] = useState<Capture | null>(null);
  const [message, setMessage] = useState('');
  const send = useSendPepTalk();
  const keyboardHeight = useKeyboardHeight();

  const take = async (kind: 'photo' | 'video', from: 'camera' | 'library' = 'camera') => {
    try {
      const result = await capturePepTalk(kind, from);
      if (result) setCapture(result);
    } catch (e) {
      Alert.alert('Couldn’t use the camera', friendlyError(e));
    }
  };

  const submit = () => {
    if (!capture || !to) return;
    send.mutate(
      { to, capture, message },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (e) => Alert.alert('Couldn’t send', friendlyError(e)),
      },
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <AppText variant="heading" color={Colors.textSecondary}>
            Cancel
          </AppText>
        </Pressable>
        <AppText variant="heading" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          Pep talk for {firstName}
        </AppText>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!capture ? (
          <>
            <View style={styles.intro}>
              <Mascot kind={mascotKind(partner?.mascot)} mood="fired_up" size={110} />
              <AppText variant="title" style={styles.center}>
                Get {firstName} moving
              </AppText>
              <AppText variant="body" color={Colors.textSecondary} style={styles.center}>
                Snap a photo or record a video, up to {PEP_TALK_MAX_SECONDS} seconds. Only {firstName} will see it.
              </AppText>
            </View>
            <Button title="📸 Take a photo" onPress={() => take('photo')} />
            <Button title="🎥 Record a video" variant="secondary" onPress={() => take('video')} />
            {__DEV__ && (
              // The iOS Simulator has no camera; development builds only.
              <View style={styles.devRow}>
                <Pressable onPress={() => take('photo', 'library')} hitSlop={8}>
                  <AppText variant="caption" color={Colors.flame}>
                    Photo from library (dev)
                  </AppText>
                </Pressable>
                <Pressable onPress={() => take('video', 'library')} hitSlop={8}>
                  <AppText variant="caption" color={Colors.flame}>
                    Video from library (dev)
                  </AppText>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.preview}>
              {capture.kind === 'photo' ? (
                <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <VideoPreview uri={capture.uri} />
              )}
            </View>
            <Pressable onPress={() => setCapture(null)} hitSlop={8} style={{ alignSelf: 'center' }}>
              <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
                {capture.kind === 'photo' ? 'Retake photo' : 'Record again'}
              </AppText>
            </Pressable>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Add a line (optional), like “You got this!”"
              placeholderTextColor={Colors.textMuted}
              maxLength={PEP_TALK_MESSAGE_MAX}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={submit}
            />
            <Button title={`📣 Send to ${firstName}`} loading={send.isPending} onPress={submit} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  intro: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  center: { textAlign: 'center' },
  devRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  preview: {
    aspectRatio: 3 / 4,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.cardRaised,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 16,
  },
});
