import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { EvidenceBadges } from '@/components/evidence-badges';
import { ReactionBar, REACTIONS } from '@/components/reaction-bar';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useNames, useWorkout } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { showCelebrationIfEarned } from '@/lib/celebrate';
import type { Workout } from '@/lib/database.types';
import { addEvidencePhotos, MAX_PHOTOS, pickPhoto, removeEvidencePhoto, useEvidenceUrls } from '@/lib/evidence';
import { supabase } from '@/lib/supabase';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending, error } = useWorkout(id);
  const me = useAuth().session?.user.id;
  const nameOf = useNames();

  if (isPending) return <Centered><ActivityIndicator color={Colors.flame} /></Centered>;
  if (error || !data) return <Centered><AppText variant="body">Workout not found.</AppText></Centered>;

  const w = data.workout;
  const isOwner = w.user_id === me;
  const started = new Date(w.started_at);

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <View style={styles.icon}>
            <SymbolView name={workoutIcon(w.activity_type)} size={40} tintColor={Colors.flame} />
          </View>
          <AppText variant="title">{workoutLabel(w.activity_type)}</AppText>
          <View style={styles.owner}>
            <Avatar id={w.user_id} name={nameOf(w.user_id)} size={22} />
            <AppText variant="caption">
              {nameOf(w.user_id)} ·{' '}
              {started.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              {' · '}
              {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </AppText>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="Duration" value={formatDuration(w.duration_s)} />
          <Stat label="Active kcal" value={w.active_kcal != null ? String(Math.round(w.active_kcal)) : '—'} />
          <Stat label="Avg HR" value={w.avg_hr != null ? `${Math.round(w.avg_hr)}` : '—'} />
          <Stat label="Max HR" value={w.max_hr != null ? `${Math.round(w.max_hr)}` : '—'} />
        </View>

        <Card>
          <AppText variant="label">Evidence</AppText>
          <EvidenceBadges workout={w} />
          <Photos workout={w} editable={isOwner} />
          <Note workout={w} editable={isOwner} />
        </Card>

        <Card>
          <AppText variant="label">{isOwner ? 'Partner reactions' : 'React'}</AppText>
          <ReactionBar workoutId={w.id} ownerId={w.user_id} reactions={data.reactions} />
          {data.reactions.length > 0 && (
            <AppText variant="caption">
              {data.reactions
                .map((r) => `${REACTIONS.find((x) => x.kind === r.kind)?.emoji} ${nameOf(r.user_id)}`)
                .join('   ')}
            </AppText>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Photos({ workout, editable }: { workout: Workout; editable: boolean }) {
  const queryClient = useQueryClient();
  const { data: urls } = useEvidenceUrls(workout.photo_paths);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['social'] });

  const add = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
      async (i) => {
        if (i === 2) return;
        setBusy(true);
        try {
          const uri = await pickPhoto(i === 0 ? 'camera' : 'library');
          if (uri) {
            await addEvidencePhotos(workout, [uri]);
            await refresh();
            await showCelebrationIfEarned(workout.user_id);
          }
        } catch (e) {
          Alert.alert('Could not add photo', e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      },
    );

  const remove = (path: string) =>
    Alert.alert('Remove photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeEvidencePhoto(workout, path);
          await refresh();
        },
      },
    ]);

  return (
    <View style={styles.photos}>
      {workout.photo_paths.map((path) => (
        <Pressable key={path} disabled={!editable} onLongPress={() => remove(path)} style={styles.photoSlot}>
          {urls?.[path] ? (
            <Image source={urls[path]} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <ActivityIndicator color={Colors.textMuted} />
          )}
        </Pressable>
      ))}
      {editable && workout.photo_paths.length < MAX_PHOTOS && (
        <Pressable onPress={add} disabled={busy} style={[styles.photoSlot, styles.addPhoto]}>
          {busy ? (
            <ActivityIndicator color={Colors.flame} />
          ) : (
            <>
              <SymbolView name="camera.fill" size={22} tintColor={Colors.flame} />
              <AppText variant="caption" style={{ fontSize: 11 }}>
                +5 XP
              </AppText>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

function Note({ workout, editable }: { workout: Workout; editable: boolean }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(workout.note ?? '');
  const [saving, setSaving] = useState(false);

  if (!editable) return workout.note ? <AppText variant="body">“{workout.note}”</AppText> : null;

  const dirty = text.trim() !== (workout.note ?? '');
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('workouts').update({ note: text.trim() || null }).eq('id', workout.id);
    setSaving(false);
    if (error) Alert.alert('Could not save note', error.message);
    else queryClient.invalidateQueries({ queryKey: ['social'] });
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <TextInput
        style={styles.note}
        placeholder="Add a note for your partners…"
        placeholderTextColor={Colors.textMuted}
        multiline
        maxLength={500}
        value={text}
        onChangeText={setText}
      />
      {dirty && <Button title="Save note" variant="secondary" loading={saving} onPress={save} />}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <AppText variant="caption" style={{ fontSize: 11 }}>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      {children}
      <Button title="Back" variant="secondary" style={{ marginTop: Spacing.md }} onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  hero: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.lg },
  icon: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    backgroundColor: Colors.flameSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: { flex: 1, padding: Spacing.sm, gap: 2, alignItems: 'center' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoSlot: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.flame, gap: 4 },
  note: {
    minHeight: 64,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
    color: Colors.text,
    padding: Spacing.md,
    fontSize: 15,
  },
});
