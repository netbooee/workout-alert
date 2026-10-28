// How strong a workout's evidence is, for display to workout partners.
// Pure so it can be unit tested.

import type { SFSymbol } from 'expo-symbols';

export interface EvidenceInput {
  source: 'healthkit' | 'manual';
  source_name: string | null;
  avg_hr: number | null;
  photo_paths: string[];
}

export interface EvidenceBadge {
  icon: SFSymbol;
  label: string;
  strength: 'strong' | 'medium' | 'weak';
}

/**
 * `alsoRecordedBy`: the other devices that recorded the same workout (their copies are
 * folded into this one server-side), which makes it stronger evidence.
 */
export function evidenceBadges(w: EvidenceInput, alsoRecordedBy: readonly string[] = []): EvidenceBadge[] {
  const badges: EvidenceBadge[] = [];
  const device = w.source_name?.trim() || 'Apple Health';

  if (w.source === 'healthkit' && w.avg_hr != null) {
    badges.push({ icon: 'heart.fill', label: `Heart rate from ${device}`, strength: 'strong' });
  } else if (w.source === 'healthkit') {
    badges.push({ icon: 'applewatch', label: `Recorded by ${device}`, strength: 'medium' });
  }

  const others = [...new Set(alsoRecordedBy.map((d) => d.trim() || 'another app'))];
  if (others.length > 0) {
    badges.push({ icon: 'checkmark.seal.fill', label: `Also recorded by ${others.join(' and ')}`, strength: 'strong' });
  }

  const photos = w.photo_paths.length;
  if (photos > 0) {
    badges.push({
      icon: 'camera.fill',
      label: `${photos} photo${photos === 1 ? '' : 's'}`,
      strength: w.source === 'manual' ? 'medium' : 'strong',
    });
  }

  if (badges.length === 0) {
    badges.push({ icon: 'hand.raised.fill', label: 'Self-reported', strength: 'weak' });
  }
  return badges;
}
