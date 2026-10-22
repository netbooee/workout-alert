import * as Haptics from 'expo-haptics';
import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
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
}: TextProps & { variant?: TextVariant; color?: ColorValue }) {
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
        // One line that shrinks to fit, so long labels and large text sizes never get
        // clipped by the button's fixed height.
        <AppText
          variant="heading"
          color={primary ? '#000' : Colors.text}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}>
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

/** A pill-style segmented control: compact by default, or `large` for switching a whole screen's section. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'small',
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  size?: 'small' | 'large';
}) {
  const large = size === 'large';
  return (
    <View style={[styles.segmented, large && styles.segmentedLarge]}>
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              onChange(o.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, large && styles.segmentLarge, selected && styles.segmentSelected]}>
            <AppText
              variant="caption"
              color={selected ? Colors.text : Colors.textSecondary}
              style={large ? styles.segmentLargeText : { fontSize: 12 }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.cardRaised,
    borderRadius: Radius.pill,
    padding: 2,
  },
  segment: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  segmentSelected: { backgroundColor: Colors.border },
  segmentedLarge: { padding: 3 },
  segmentLarge: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  segmentLargeText: { fontSize: 15, fontWeight: '600' },
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
