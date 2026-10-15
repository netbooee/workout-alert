import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Lotl } from '@/components/lotl';
import { AppText, Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLotl } from '@/hooks/use-lotl';
import { LOTL_LOOKS } from '@/lib/lotl';

/** Lotl's once-a-day greeting: mood, one headline, up to three facts, one action. */
export default function GreetingScreen() {
  // The greeting is the one place Lotl may be properly fired up.
  const message = useLotl({ calm: false });

  useEffect(() => {
    if (!message) return;
    Haptics.notificationAsync(
      message.mood === 'blazing'
        ? Haptics.NotificationFeedbackType.Success
        : message.mood === 'fired_up'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
    );
  }, [message?.mood]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!message) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.flame} />
      </View>
    );
  }

  const look = LOTL_LOOKS[message.mood];
  const act = () => {
    router.back();
    if (message.action.href) router.push(message.action.href);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.stage}>
          <View style={[styles.glow, { backgroundColor: look.accent }]} />
          <Lotl mood={message.mood} size={170} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={[styles.bubble, { borderColor: look.accent }]}>
          <View style={[styles.tail, { borderBottomColor: look.accent }]} />
          <AppText variant="title" style={styles.headline}>
            {message.headline}
          </AppText>
        </Animated.View>

        <View style={styles.facts}>
          {message.facts.map((f, i) => (
            <Animated.View key={f.text} entering={FadeIn.delay(400 + i * 120)} style={styles.fact}>
              <AppText variant="body">{f.emoji}</AppText>
              <AppText variant="body" style={{ flex: 1 }}>
                {f.text}
              </AppText>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(700)} style={{ gap: Spacing.sm }}>
        <Button title={message.action.label} onPress={act} />
        {message.action.href && <Button title="Later" variant="secondary" onPress={() => router.back()} />}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  stage: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, opacity: 0.16 },
  bubble: {
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    padding: Spacing.md,
  },
  tail: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  headline: { fontSize: 22, textAlign: 'center', lineHeight: 28 },
  facts: { alignSelf: 'stretch', gap: Spacing.sm },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
});
