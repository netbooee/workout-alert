import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useProfilePhotoUrl } from '@/lib/profile-photo';
import { usePartners } from '@/hooks/use-social';

const PALETTE = ['#FF6B1A', '#3BD1FF', '#9BF03C', '#FF375F', '#B38CFF', '#FFD60A', '#34D399'];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/**
 * Someone's profile photo, or their initials on a color of their own until
 * the photo loads (or if they have none). Photos are found by id: yours from
 * your profile, partners' from the partners list, so callers only pass an id.
 */
export function Avatar({ id, name, size = 40 }: { id: string; name: string | null; size?: number }) {
  const path = useAvatarPath(id);
  const url = useProfilePhotoUrl(path);
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.circle, round, { backgroundColor: colorFor(id) }]}>
      <AppText variant="heading" color="#000" style={{ fontSize: size * 0.4 }}>
        {initials || '?'}
      </AppText>
      {url && path ? (
        <Image
          // Cached by path, so a fresh signed link doesn't download the photo again.
          source={{ uri: url, cacheKey: path }}
          cachePolicy="disk"
          transition={150}
          style={[StyleSheet.absoluteFill, round]}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

function useAvatarPath(id: string): string | null {
  const { profile } = useAuth();
  const { data: partners } = usePartners();
  if (id === profile?.id) return profile.avatar_url;
  return partners?.find((p) => p.partner_id === id)?.avatar_url ?? null;
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
