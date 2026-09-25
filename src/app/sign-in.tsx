import * as AppleAuthentication from 'expo-apple-authentication';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleButton } from '@/components/google-button';
import { AppText, Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { googleEnabled, signInWithGoogle } from '@/lib/google-auth';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={styles.inner}>
        <View style={styles.hero}>
          <SymbolView name="flame.fill" size={72} tintColor={Colors.flame} />
          <AppText variant="title">Streaks</AppText>
          <AppText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
            Work out with your people. Keep the streak alive together.
          </AppText>
        </View>
        <View style={styles.actions}>
          <AppleSignIn />
          {googleEnabled && <GoogleSignIn />}
          <AppText variant="caption" style={{ textAlign: 'center' }}>
            or
          </AppText>
          <EmailSignIn />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AppleSignIn() {
  const signIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      // Apple only shares the name on the very first sign-in, so save it now.
      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      if (name && data.user) {
        await supabase.from('profiles').update({ display_name: name }).eq('id', data.user.id);
      }
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Sign in failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={Radius.md}
      style={{ height: 52 }}
      onPress={signIn}
    />
  );
}

function GoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  return <GoogleButton onPress={signIn} disabled={loading} />;
}

function EmailSignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<{ error: Error | null }>) => {
    setLoading(true);
    const { error } = await fn();
    setLoading(false);
    if (error) Alert.alert('Something went wrong', error.message);
    return !error;
  };

  if (!sent) {
    return (
      <>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Button
          title="Email me a code"
          variant="secondary"
          loading={loading}
          disabled={!email.includes('@')}
          onPress={async () => {
            if (await run(() => supabase.auth.signInWithOtp({ email: email.trim() }))) setSent(true);
          }}
        />
      </>
    );
  }

  return (
    <>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        Enter the code we sent to {email.trim()}
      </AppText>
      <TextInput
        style={[styles.input, styles.code]}
        placeholder="123456"
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={8}
        value={code}
        onChangeText={setCode}
      />
      <Button
        title="Sign in"
        loading={loading}
        disabled={code.length < 6}
        onPress={() =>
          run(() => supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' }))
        }
      />
      <Button title="Use a different email" variant="secondary" onPress={() => setSent(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, padding: Spacing.lg, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  actions: { gap: Spacing.md },
  input: {
    height: 52,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    fontSize: 17,
  },
  code: { textAlign: 'center', letterSpacing: 8, fontSize: 22 },
});
