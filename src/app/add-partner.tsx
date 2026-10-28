import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequestPartner } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { inviteMessage } from '@/lib/invite-link';
import { requestOutcome } from '@/lib/partner-request';

export default function AddPartnerScreen() {
  const profile = useProfile();
  const request = useRequestPartner();
  const [code, setCode] = useState('');

  const share = () => Share.share({ message: inviteMessage(profile.invite_code) });

  const send = () =>
    request.mutate(code, {
      onSuccess: (p) => {
        const { title, body } = requestOutcome(p, profile.id);
        Alert.alert(title, body);
        router.back();
      },
      onError: (e) => Alert.alert('Couldn’t add partner', friendlyError(e)),
    });

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <View style={styles.header}>
        <AppText variant="title">Add a partner</AppText>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AppText variant="heading" color={Colors.flame}>
            Done
          </AppText>
        </Pressable>
      </View>

      <Card style={styles.codeCard}>
        <AppText variant="label">Your invite code</AppText>
        <AppText variant="display" style={styles.code} selectable>
          {profile.invite_code}
        </AppText>
        <Button title="Share invite" onPress={share} />
        <View style={styles.bonus}>
          <AppText style={{ fontSize: 20, lineHeight: 24 }}>🎁</AppText>
          <AppText variant="caption" color={Colors.text} style={{ flex: 1 }}>
            <AppText variant="caption" color={Colors.text} style={{ fontWeight: '800' }}>
              +100 XP for you both
            </AppText>{' '}
            when a friend joins with your invite and logs their first workout.
          </AppText>
        </View>
      </Card>

      <Card>
        <AppText variant="label">Have someone’s code?</AppText>
        <TextInput
          style={styles.input}
          placeholder="ABCD23"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
        />
        <Button
          title="Send request"
          variant="secondary"
          disabled={code.length !== 6}
          loading={request.isPending}
          onPress={send}
        />
      </Card>

      <AppText variant="caption" style={{ textAlign: 'center' }}>
        Partners see each other’s workouts, streaks, and check-in photos. To remove a partner, tap
        Edit on the Friends tab of your streak.
      </AppText>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'stretch',
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.xpSoft,
  },
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeCard: { alignItems: 'stretch', gap: Spacing.md },
  code: { textAlign: 'center', letterSpacing: 8, fontSize: 44, color: Colors.flame },
  input: {
    height: 56,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.cardRaised,
    color: Colors.text,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 6,
    fontWeight: '700',
  },
});
