import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { BuddyChip } from '@/components/buddy-avatar';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { chatTime, momentText, reactionEmoji, type ChatItem } from '@/lib/chat';
import type { ChatMessage, ChatReaction } from '@/lib/database.types';
import { MASCOTS, mascotKind } from '@/lib/mascots';

const BUDDY = 30;

interface RowProps {
  item: Extract<ChatItem, { type: 'message' }>;
  onReact: (m: ChatMessage, r: ChatReaction) => void;
  onLongPress: (m: ChatMessage) => void;
}

/** One row of the chat: a bubble, or a moment the app posted. */
export function ChatRow({ item, onReact, onLongPress }: RowProps) {
  const m = item.message;
  if (m.kind === 'text') return <Bubble {...{ item, onReact, onLongPress }} />;
  return <Moment message={m} onReact={onReact} onLongPress={onLongPress} />;
}

function Bubble({ item, onReact, onLongPress }: RowProps) {
  const m = item.message;
  const mine = m.is_me;
  const pending = m.id.startsWith('pending-');
  return (
    <View style={[styles.row, mine && styles.rowMine, !item.showBuddy && styles.rowTight]}>
      {!mine && (
        // Sits by the bubble, not the reactions under it.
        <View style={{ width: BUDDY, marginBottom: m.reactions.length ? 30 : 0 }}>
          {item.showBuddy && <BuddyChip mascot={m.mascot} size={BUDDY} />}
        </View>
      )}
      <View style={[styles.column, mine && { alignItems: 'flex-end' }]}>
        {!mine && item.showName && (
          <AppText variant="caption" style={styles.name}>
            {m.name}
          </AppText>
        )}
        <Pressable
          onLongPress={pending ? undefined : () => onLongPress(m)}
          delayLongPress={300}
          accessibilityHint="Press and hold to react, report or delete"
          accessibilityLabel={`${mine ? 'You' : m.name}: ${m.body}. ${chatTime(new Date(m.created_at))}`}
          style={({ pressed }) => [
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            mine ? { borderBottomRightRadius: item.showBuddy ? 6 : 18 } : { borderBottomLeftRadius: item.showBuddy ? 6 : 18 },
            (pressed || pending) && { opacity: 0.7 },
          ]}>
          <AppText variant="body" color={mine ? '#000' : Colors.text} style={styles.bubbleText}>
            {m.body}
          </AppText>
        </Pressable>
        <Reactions message={m} onReact={onReact} />
      </View>
    </View>
  );
}

function Moment({
  message: m,
  onReact,
  onLongPress,
}: {
  message: ChatMessage;
  onReact: RowProps['onReact'];
  onLongPress: RowProps['onLongPress'];
}) {
  const buddy = MASCOTS[mascotKind(m.mascot)];
  if (m.kind === 'joined') {
    return (
      <Pressable onLongPress={() => onLongPress(m)} style={styles.joined}>
        <BuddyChip mascot={m.mascot} size={22} />
        <AppText variant="caption">{momentText(m.kind, m.name, m.is_me)} 👋</AppText>
      </Pressable>
    );
  }
  const treat = m.reactions.find((r) => r.reaction === 'treat');
  const squad = m.kind === 'squad_done';
  return (
    <Pressable onLongPress={() => onLongPress(m)} style={styles.moment}>
      <View style={styles.momentTop}>
        {squad ? (
          <AppText style={{ fontSize: 30 }}>🔥</AppText>
        ) : (
          <BuddyChip mascot={m.mascot} size={42} mood="blazing" />
        )}
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{momentText(m.kind, m.name, m.is_me)}</AppText>
          <AppText variant="caption">
            {squad ? 'Enough of you hit your goals to keep the squad streak going.' : `${buddy.name} is so proud.`}
          </AppText>
        </View>
      </View>
      {!squad && (
        <View style={styles.momentActions}>
          {!m.is_me && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onReact(m, 'treat');
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: !!treat?.mine }}
              style={({ pressed }) => [styles.toss, treat?.mine && styles.tossDone, pressed && { opacity: 0.8 }]}>
              <AppText variant="heading" color={treat?.mine ? Colors.flame : '#000'} style={{ fontSize: 15 }}>
                {treat?.mine ? `${buddy.treat.emoji} Tossed!` : `${buddy.treat.emoji} Toss ${buddy.name} a treat`}
              </AppText>
            </Pressable>
          )}
          {treat && (
            <AppText variant="caption">
              {treat.count === 1 ? '1 treat tossed' : `${treat.count} treats tossed`}
            </AppText>
          )}
        </View>
      )}
      {squad && <Reactions message={m} onReact={onReact} />}
    </Pressable>
  );
}

function Reactions({ message: m, onReact }: { message: ChatMessage; onReact: RowProps['onReact'] }) {
  if (m.reactions.length === 0) return null;
  return (
    <View style={[styles.reactions, m.is_me && { justifyContent: 'flex-end' }]}>
      {m.reactions.map((r) => (
        <Pressable
          key={r.reaction}
          onPress={() => onReact(m, r.reaction)}
          accessibilityRole="button"
          accessibilityState={{ selected: r.mine }}
          accessibilityLabel={`${r.reaction}, ${r.count}`}
          style={[styles.chip, r.mine && styles.chipMine]}>
          <AppText style={{ fontSize: 13 }}>{reactionEmoji(r.reaction, m.mascot)}</AppText>
          <AppText variant="caption" color={Colors.text} style={{ fontSize: 13, fontWeight: '700' }}>
            {r.count}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

/** "Today" between days. */
export function DayDivider({ label }: { label: string }) {
  return (
    <AppText variant="caption" style={styles.day}>
      {label}
    </AppText>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  rowMine: { justifyContent: 'flex-end' },
  rowTight: { marginTop: 2 },
  column: { maxWidth: '78%', gap: 2 },
  name: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { backgroundColor: Colors.flame },
  bubbleTheirs: { backgroundColor: Colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  bubbleText: { fontSize: 16, lineHeight: 21 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipMine: { backgroundColor: Colors.flameSoft, borderColor: Colors.flame },
  joined: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, marginTop: Spacing.sm },
  moment: {
    marginTop: Spacing.sm,
    padding: Spacing.sm + 4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.flameSoft,
    gap: Spacing.sm,
  },
  momentTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2 },
  momentActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  toss: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tossDone: { backgroundColor: Colors.card },
  day: { alignSelf: 'center', fontSize: 12, fontWeight: '700', marginTop: Spacing.md },
});
