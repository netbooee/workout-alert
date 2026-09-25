import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/lib/auth';
import { showCelebrationIfEarned } from '@/lib/celebrate';
import { addEvidencePhotos, MAX_PHOTOS, pickPhoto } from '@/lib/evidence';
import { supabase } from '@/lib/supabase';
import { workoutIcon, workoutLabel } from '@/lib/workout-types';

const TYPES = [
  'traditionalStrengthTraining',
  'running',
  'walking',
  'cycling',
  'highIntensityIntervalTraining',
  'yoga',
  'swimming',
  'hiking',
  'other',
] as const;
const DURATIONS = [15, 30, 45, 60, 90];

/** Log a workout by hand, e.g. a gym session without a watch. Photos make it verifiable. */
export default function LogWorkoutScreen() {
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [type, setType] = useState<(typeof TYPES)[number]>('traditionalStrengthTraining');
  const [minutes, setMinutes] = useState(45);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const addPhoto = async (from: 'camera' | 'library') => {
    try {
      const uri = await pickPhoto(from);
      if (uri) setPhotos((p) => [...p, uri].slice(0, MAX_PHOTOS));
    } catch (e) {
      Alert.alert('Could not add photo', e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const ended = new Date();
      const started = new Date(ended.getTime() - minutes * 60_000);
      const { data: workout, error } = await supabase
        .from('workouts')
        .insert({
          source: 'manual',
          activity_type: type,
          started_at: started.toISOString(),
          ended_at: ended.toISOString(),
          duration_s: minutes * 60,
          note: note.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      if (photos.length) await addEvidencePhotos(workout, photos);

      await queryClient.invalidateQueries();
      router.back();
      await showCelebrationIfEarned(profile.id);
    } catch (e) {
      Alert.alert('Could not log workout', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AppText variant="heading" color={Colors.textSecondary}>
            Cancel
          </AppText>
        </Pressable>
        <AppText variant="heading">Log workout</AppText>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="label">What did you do?</AppText>
        <View style={styles.grid}>
          {TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.type, t === type && styles.selected]}>
              <SymbolView name={workoutIcon(t)} size={22} tintColor={t === type ? '#000' : Colors.flame} />
              <AppText variant="caption" color={t === type ? '#000' : Colors.text}>
                {workoutLabel(t)}
              </AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="label">How long?</AppText>
        <View style={styles.durations}>
          {DURATIONS.map((m) => (
            <Pressable key={m} onPress={() => setMinutes(m)} style={[styles.duration, m === minutes && styles.selected]}>
              <AppText variant="heading" color={m === minutes ? '#000' : Colors.text}>
                {m}
              </AppText>
              <AppText variant="caption" color={m === minutes ? '#000' : Colors.textSecondary} style={{ fontSize: 11 }}>
                min
              </AppText>
            </Pressable>
          ))}
        </View>

        <Card>
          <View style={styles.evidenceHeader}>
            <AppText variant="label">Evidence</AppText>
            <AppText variant="caption" color={Colors.xp}>
              +5 XP with a photo
            </AppText>
          </View>
          <AppText variant="caption">
            Hand-logged workouts show as self-reported unless you add a photo: the gym, your
            screen, a sweaty selfie.
          </AppText>
          <View style={styles.photos}>
            {photos.map((uri) => (
              <Pressable key={uri} onLongPress={() => setPhotos((p) => p.filter((x) => x !== uri))}>
                <Image source={uri} style={styles.thumb} contentFit="cover" />
              </Pressable>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <Pressable onPress={() => addPhoto('camera')} style={[styles.thumb, styles.addPhoto]}>
                  <SymbolView name="camera.fill" size={22} tintColor={Colors.flame} />
                </Pressable>
                <Pressable onPress={() => addPhoto('library')} style={[styles.thumb, styles.addPhoto]}>
                  <SymbolView name="photo.on.rectangle" size={22} tintColor={Colors.flame} />
                </Pressable>
              </>
            )}
          </View>
          <TextInput
            style={styles.note}
            placeholder="Add a note (optional)"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            value={note}
            onChangeText={setNote}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={`Log ${minutes} min ${workoutLabel(type)}`} loading={saving} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  type: {
    width: '31.5%',
    height: 76,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selected: { backgroundColor: Colors.flame },
  durations: { flexDirection: 'row', gap: Spacing.sm },
  duration: {
    flex: 1,
    height: 60,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: Radius.sm, borderCurve: 'continuous' },
  addPhoto: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    minHeight: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
    color: Colors.text,
    padding: Spacing.md,
    fontSize: 15,
  },
  footer: { padding: Spacing.md, paddingBottom: Spacing.xl },
});
