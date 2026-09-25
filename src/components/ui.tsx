import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { Colors, Font, Radius, Spacing } from '@/constants/theme';

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';

export function AppText({
  variant = 'body',
  color,
  style,
  ...props
}: TextProps & { variant?: TextVariant; color?: string }) {
  return <Text {...props} style={[textStyles[variant], color ? { color } : null, style]} />;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? '#000' : Colors.text} />
      ) : (
        <AppText variant="heading" color={primary ? '#000' : Colors.text}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const textStyles = StyleSheet.create({
  display: { fontFamily: Font.rounded, fontSize: 56, fontWeight: '800', color: Colors.text, fontVariant: ['tabular-nums'] },
  title: { fontFamily: Font.rounded, fontSize: 28, fontWeight: '700', color: Colors.text },
  heading: { fontSize: 17, fontWeight: '600', color: Colors.text },
  body: { fontSize: 15, color: Colors.text, lineHeight: 21 },
  caption: { fontSize: 13, color: Colors.textSecondary },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  button: {
    height: 52,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonPrimary: { backgroundColor: Colors.flame },
  buttonSecondary: { backgroundColor: Colors.cardRaised },
});
