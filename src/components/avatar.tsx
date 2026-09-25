import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';

const PALETTE = ['#FF6B1A', '#3BD1FF', '#9BF03C', '#FF375F', '#B38CFF', '#FFD60A', '#34D399'];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function Avatar({ id, name, size = 40 }: { id: string; name: string | null; size?: number }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(id) },
      ]}>
      <AppText variant="heading" color="#000" style={{ fontSize: size * 0.4 }}>
        {initials || '?'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
