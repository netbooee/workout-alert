import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuddyChip } from '@/components/buddy-avatar';
import { ChatRow, DayDivider } from '@/components/chat-message';
import { MessageActions, type MessageAction } from '@/components/message-actions';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  useChatRealtime,
  useDeleteMessage,
  useGroupChat,
  useMarkRead,
  useSendMessage,
  useToggleReaction,
} from '@/hooks/use-chat';
import { useGroupBoard, useMyGroups } from '@/hooks/use-groups';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useSafetyActions } from '@/hooks/use-safety';
import { chatItems, MAX_MESSAGE_LENGTH } from '@/lib/chat';
import { setOpenChat } from '@/lib/chat-focus';
import type { ChatMessage, ChatReaction } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: groups, isPending: groupsPending } = useMyGroups();
  const group = groups?.find((g) => g.id === id);
  const { data: board } = useGroupBoard(id);
  const chat = useGroupChat(id);
  const send = useSendMessage(id);
  const remove = useDeleteMessage(id);
  const react = useToggleReaction(id);
  const markRead = useMarkRead(id);
  const { report, block } = useSafetyActions();
  const [text, setText] = useState('');
  const [held, setHeld] = useState<ChatMessage | null>(null);
  const keyboard = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  useChatRealtime(id);

  const messages = useMemo(() => chat.data?.pages.flat() ?? [], [chat.data]);
  const items = useMemo(() => chatItems(messages), [messages]);
  const newest = messages[0]?.id;

  // While the chat is open: no banners for it, and anything new counts as read.
  useFocusEffect(
    useCallback(() => {
      setOpenChat(id);
      return () => setOpenChat(null);
    }, [id]),
  );
  const { mutate: read } = markRead;
  useEffect(() => {
    if (id && chat.isSuccess) read();
  }, [id, newest, chat.isSuccess, read]);

  if (!group) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Chat' }} />
        {groupsPending ? (
          <ActivityIndicator color={Colors.flame} />
        ) : (
          <AppText variant="body" color={Colors.textSecondary}>
            You’re not in this group anymore.
          </AppText>
        )}
      </View>
    );
  }

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    setText('');
    send.mutate(body, {
      onError: (e) => {
        setText(body);
        Alert.alert('Couldn’t send', friendlyError(e));
      },
    });
  };

  const onReact = (m: ChatMessage, reaction: ChatReaction) =>
    react.mutate({ id: m.id, reaction }, { onError: (e) => Alert.alert('Couldn’t react', friendlyError(e)) });

  const confirmDelete = (m: ChatMessage) =>
    Alert.alert(m.is_me ? 'Delete your message?' : 'Delete for everyone?', 'It’s removed from the chat for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(m.id, { onError: (e) => Alert.alert('Couldn’t delete', friendlyError(e)) }),
      },
    ]);

  const actionsFor = (m: ChatMessage): MessageAction[] => {
    const list: MessageAction[] = [];
    if (m.kind === 'text' && !m.is_me && m.user_id) {
      const target = { userId: m.user_id, name: m.name, kind: 'group_message' as const, refId: m.id };
      list.push({ label: 'Report message', icon: 'flag', onPress: () => report(target) });
      list.push({ label: `Block ${m.name}`, icon: 'nosign', onPress: () => block(target) });
    }
    if (m.is_me && m.kind === 'text') {
      list.push({ label: 'Delete', icon: 'trash', destructive: true, onPress: () => confirmDelete(m) });
    } else if (group.role === 'owner') {
      list.push({ label: 'Delete for everyone', icon: 'trash', destructive: true, onPress: () => confirmDelete(m) });
    }
    return list;
  };

  const buddies = (board ?? []).slice(0, 5);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${group.name}, ${group.member_count} people. Open the group`}
              style={styles.header}>
              <AppText variant="heading" numberOfLines={1}>
                {group.emoji} {group.name}
              </AppText>
              <View style={styles.headerSub}>
                <View style={styles.stack}>
                  {buddies.map((b, i) => (
                    <View key={b.user_id} style={{ marginLeft: i ? -6 : 0 }}>
                      <BuddyChip mascot={b.mascot} size={18} />
                    </View>
                  ))}
                </View>
                <AppText variant="caption" style={{ fontSize: 12 }}>
                  {group.member_count} {group.member_count === 1 ? 'person' : 'people'} · squad 🔥 {group.squad_streak}
                </AppText>
              </View>
            </Pressable>
          ),
        }}
      />

      <FlatList
        inverted
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) =>
          item.type === 'day' ? (
            <DayDivider label={item.label} />
          ) : (
            <ChatRow item={item} onReact={onReact} onLongPress={setHeld} />
          )
        }
        contentContainerStyle={styles.list}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onEndReached={() => chat.hasNextPage && !chat.isFetchingNextPage && chat.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          chat.isPending ? (
            <ActivityIndicator color={Colors.flame} style={{ marginTop: Spacing.xl }} />
          ) : (
            <View style={styles.empty}>
              <AppText variant="heading" style={{ textAlign: 'center' }}>
                Say hi to {group.name} 👋
              </AppText>
              <AppText variant="caption" style={{ textAlign: 'center' }}>
                Plan a walk, cheer someone on, or just check in. Weekly goals and squad wins show up here too.
              </AppText>
            </View>
          )
        }
      />

      <View style={[styles.composer, { paddingBottom: keyboard ? keyboard + Spacing.sm : insets.bottom + Spacing.sm }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Message ${group.name}`}
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel="Message"
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          style={styles.input}
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={({ pressed }) => [styles.send, !text.trim() && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
          <SymbolView name="paperplane.fill" size={20} tintColor="#000" />
        </Pressable>
      </View>

      <MessageActions
        message={held}
        actions={held ? actionsFor(held) : []}
        onReact={onReact}
        onClose={() => setHeld(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: 2, maxWidth: 260 },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { flexDirection: 'row' },
  list: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, flexGrow: 1 },
  // The list is inverted, so flip the empty state back upright.
  empty: { flex: 1, justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, transform: [{ scaleY: -1 }] },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm + 4,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
