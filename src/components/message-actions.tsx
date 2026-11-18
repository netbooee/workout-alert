import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CHAT_REACTIONS, momentText, reactionEmoji } from '@/lib/chat';
import type { ChatMessage, ChatReaction } from '@/lib/database.types';

export interface MessageAction {
  label: string;
  icon: SFSymbol;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Press and hold a message: react with one of five, then the message's own
 * choices (report, block, delete) underneath, over a dimmed chat.
 */
export function MessageActions({
  message,
  actions,
  onReact,
  onClose,
}: {
  message: ChatMessage | null;
  actions: MessageAction[];
  onReact: (m: ChatMessage, r: ChatReaction) => void;
  onClose: () => void;
}) {
  const m = message;
  return (
    <Modal visible={!!m} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
        {m && (
          <View style={[styles.sheet, m.is_me && { alignItems: 'flex-end' }]}>
            <View style={styles.reactions} accessibilityRole="toolbar">
              {CHAT_REACTIONS.map((r) => {
                const mine = m.reactions.some((x) => x.reaction === r.key && x.mine);
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onReact(m, r.key);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={r.label}
                    accessibilityState={{ selected: mine }}
                    style={[styles.reaction, mine && { backgroundColor: Colors.flameSoft }]}>
                    <AppText style={{ fontSize: 24 }}>{reactionEmoji(r.key, m.mascot)}</AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.preview, m.is_me && styles.previewMine]}>
              <AppText variant="body" color={m.is_me ? '#000' : Colors.text} numberOfLines={6}>
                {m.kind === 'text' ? m.body : momentText(m.kind, m.name, m.is_me)}
              </AppText>
            </View>

            {actions.length > 0 && (
              <View style={styles.menu}>
                {actions.map((a, i) => (
                  <Pressable
                    key={a.label}
                    onPress={() => {
                      onClose();
                      a.onPress();
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.item,
                      i < actions.length - 1 && styles.itemDivider,
                      pressed && { backgroundColor: Colors.cardRaised },
                    ]}>
                    <AppText variant="body" color={a.destructive ? Colors.danger : Colors.text}>
                      {a.label}
                    </AppText>
                    <SymbolView name={a.icon} size={18} tintColor={a.destructive ? Colors.danger : Colors.text} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.md },
  sheet: { gap: Spacing.sm, alignItems: 'flex-start' },
  reactions: { flexDirection: 'row', gap: 2, padding: 4, borderRadius: Radius.pill, backgroundColor: Colors.card },
  reaction: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  preview: {
    maxWidth: '85%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: Colors.card,
  },
  previewMine: { backgroundColor: Colors.flame },
  menu: { width: 250, borderRadius: Radius.md, backgroundColor: Colors.card, overflow: 'hidden' },
  item: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
});
