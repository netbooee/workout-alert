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
import { Comments } from '@/components/comments';
import { EvidenceBadges } from '@/components/evidence-badges';
import { PhotoViewer } from '@/components/photo-viewer';
import { ReactionBar, REACTIONS } from '@/components/reaction-bar';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useNames, useWorkout } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { showCelebrationIfEarned } from '@/lib/celebrate';
import type { Workout } from '@/lib/database.types';
import {
  addEvidencePhotos,
  deleteWorkout,
  MAX_PHOTOS,
  pickPhoto,
  removeEvidencePhoto,
  useEvidenceUrls,
} from '@/lib/evidence';
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
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
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
          <AppText variant="label">Check-in</AppText>
          <EvidenceBadges workout={w} alsoRecordedBy={data.alsoRecordedBy} />
          <Photos workout={w} editable={isOwner} />
          <Note workout={w} editable={isOwner} />
        </Card>

        <Card>
          <AppText variant="label">{isOwner ? 'Partner cheers' : 'Cheer'}</AppText>
          <ReactionBar workoutId={w.id} ownerId={w.user_id} reactions={data.reactions} />
          {data.reactions.length > 0 && (
            <AppText variant="caption">
              {data.reactions
                .map((r) => `${REACTIONS.find((x) => x.kind === r.kind)?.emoji} ${nameOf(r.user_id)}`)
                .join('   ')}
            </AppText>
          )}
        </Card>

        <Comments workout={w} />

        {!isOwner && <RewardPrompt partnerId={w.user_id} name={nameOf(w.user_id)} />}

        {isOwner && <DeleteWorkout workout={w} />}
      </ScrollView>
    </SafeAreaView>
  );
}

/** On a partner's workout: challenge them (unless a challenge is already going). */
function RewardPrompt({ partnerId, name }: { partnerId: string; name: string }) {
  const { given } = useMyIncentives();
  const active = given.some(
    (i) => i.to_id === partnerId && ['offered', 'active', 'earned'].includes(i.status),
  );
  if (active) return null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/incentive/new', params: { to: partnerId } })}
      style={styles.reward}>
      <AppText variant="body">🎯</AppText>
      <View style={{ flex: 1 }}>
        <AppText variant="heading" style={{ fontSize: 15 }}>
          Challenge {name.split(' ')[0]}
        </AppText>
        <AppText variant="caption">Reward a stretch goal, or take one on together. +100 XP.</AppText>
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={Colors.textMuted} />
    </Pressable>
  );
}

function DeleteWorkout({ workout }: { workout: Workout }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  // Apple Health is the source of truth for synced workouts: deleting one here
  // would bring it back on the next full sync, so point people to Health.
  if (workout.source === 'healthkit') {
    return (
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        From Apple Health. To remove it, delete it in the Health app and it disappears here on the
        next sync.
      </AppText>
    );
  }

  const confirm = () =>
    Alert.alert(
      'Delete this workout?',
      'Its photos, reactions, and XP are removed too, and your streak is updated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteWorkout(workout);
              await queryClient.invalidateQueries();
              router.back();
            } catch (e) {
              setDeleting(false);
              Alert.alert('Could not delete workout', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );

  return (
    <Pressable onPress={confirm} disabled={deleting} style={styles.delete} hitSlop={8}>
      {deleting ? (
        <ActivityIndicator color={Colors.danger} />
      ) : (
        <AppText variant="heading" color={Colors.danger}>
          Delete workout
        </AppText>
      )}
    </Pressable>
  );
}

function Photos({ workout, editable }: { workout: Workout; editable: boolean }) {
  const queryClient = useQueryClient();
  const { data: urls } = useEvidenceUrls(workout.photo_paths);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const loaded = workout.photo_paths.map((p) => urls?.[p]).filter((u): u is string => !!u);

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
        <Pressable
          key={path}
          disabled={!urls?.[path]}
          onPress={() => setViewing(loaded.indexOf(urls![path]!))}
          onLongPress={editable ? () => remove(path) : undefined}
          accessibilityRole="imagebutton"
          accessibilityLabel="Open photo"
          accessibilityHint={editable ? 'Press and hold to remove' : undefined}
          style={styles.photoSlot}>
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
      <PhotoViewer urls={loaded} index={viewing} onClose={() => setViewing(null)} />
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
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    backgroundColor: Colors.flameSoft,
  },
  delete: { alignItems: 'center', paddingVertical: Spacing.md },
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
