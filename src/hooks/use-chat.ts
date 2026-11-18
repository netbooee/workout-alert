import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { chatBadge } from '@/lib/chat';
import type { ChatMessage, ChatReaction, ChatSummary } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

const PAGE = 60;
let channelCount = 0;

const chatsKey = (userId: string | undefined) => ['chats', userId];
const chatKey = (groupId: string) => ['chat', groupId];

type Pages = InfiniteData<ChatMessage[], string | null>;

/** Every group you're in, newest conversation first, with unread counts. */
export function useMyChats() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: chatsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ChatSummary[]> => {
      const { data, error } = await supabase.rpc('my_chats');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The number on the Chats tab. */
export function useChatBadge() {
  return chatBadge(useMyChats().data);
}

/** A group's chat, newest first, a page at a time. */
export function useGroupChat(groupId: string) {
  return useInfiniteQuery({
    queryKey: chatKey(groupId),
    enabled: !!groupId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ChatMessage[]> => {
      const { data, error } = await supabase.rpc('group_chat', {
        p_group: groupId,
        p_before: pageParam,
        p_limit: PAGE,
      });
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]!.created_at : undefined),
  });
}

function useRefreshChat(groupId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chatKey(groupId) }),
      queryClient.invalidateQueries({ queryKey: ['chats'] }),
    ]);
}

export function useSendMessage(groupId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const refresh = useRefreshChat(groupId);
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc('send_group_message', { p_group: groupId, p_body: body });
      if (error) throw error;
    },
    // Show it right away; the refetch swaps in the saved copy.
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: chatKey(groupId) });
      const pending: ChatMessage = {
        id: `pending-${Date.now()}`,
        user_id: profile?.id ?? null,
        kind: 'text',
        body: body.trim(),
        created_at: new Date().toISOString(),
        name: 'You',
        mascot: profile?.mascot ?? null,
        avatar_url: profile?.avatar_url ?? null,
        is_me: true,
        reactions: [],
      };
      queryClient.setQueryData<Pages>(chatKey(groupId), (old) =>
        old ? { ...old, pages: [[pending, ...(old.pages[0] ?? [])], ...old.pages.slice(1)] } : old,
      );
    },
    onSettled: refresh,
  });
}

export function useDeleteMessage(groupId: string) {
  const refresh = useRefreshChat(groupId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_group_message', { p_message: id });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** Adds a reaction, or takes it back. Updates the bubble right away. */
export function useToggleReaction(groupId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshChat(groupId);
  return useMutation({
    mutationFn: async ({ id, reaction }: { id: string; reaction: ChatReaction }) => {
      const { error } = await supabase.rpc('toggle_group_reaction', { p_message: id, p_reaction: reaction });
      if (error) throw error;
    },
    onMutate: async ({ id, reaction }) => {
      await queryClient.cancelQueries({ queryKey: chatKey(groupId) });
      queryClient.setQueryData<Pages>(chatKey(groupId), (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) =>
                page.map((m) => (m.id === id ? { ...m, reactions: toggled(m.reactions, reaction) } : m)),
              ),
            }
          : old,
      );
    },
    onSettled: refresh,
  });
}

function toggled(reactions: ChatMessage['reactions'], reaction: ChatReaction): ChatMessage['reactions'] {
  const found = reactions.find((r) => r.reaction === reaction);
  if (!found) return [...reactions, { reaction, count: 1, mine: true }];
  const count = found.count + (found.mine ? -1 : 1);
  return count === 0
    ? reactions.filter((r) => r.reaction !== reaction)
    : reactions.map((r) => (r.reaction === reaction ? { ...r, count, mine: !r.mine } : r));
}

export function useMarkRead(groupId: string) {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_group_read', { p_group: groupId });
      if (error) throw error;
    },
    onMutate: () => {
      queryClient.setQueryData<ChatSummary[]>(chatsKey(userId), (old) =>
        old?.map((c) => (c.group_id === groupId ? { ...c, unread: 0 } : c)),
      );
    },
  });
}

export function useSetChatMuted(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (muted: boolean) => {
      const { error } = await supabase.rpc('set_group_chat_muted', { p_group: groupId, p_muted: muted });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['chats'] }),
  });
}

/**
 * Keeps chats live while the app is open: new and deleted messages in any of
 * your groups refresh the Chats tab and that chat. Pass a group to also follow
 * its reactions (while that chat is on screen).
 */
export function useChatRealtime(groupId?: string) {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;

  useEffect(() => {
    if (!userId) return;
    // A name of its own per screen: supabase.channel() hands back an existing
    // channel with the same name, and the same chat can be open twice in the stack.
    const name = `${groupId ? `chat:${groupId}` : `chats:${userId}`}:${++channelCount}`;
    const channel = supabase.channel(name);
    if (groupId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_message_reactions', filter: `group_id=eq.${groupId}` },
        () => queryClient.invalidateQueries({ queryKey: chatKey(groupId) }),
      );
    } else {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages' }, (payload) => {
        const group = (payload.new as { group_id?: string } | null)?.group_id;
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        // Deletes only carry the id, so refresh any open chat.
        queryClient.invalidateQueries({ queryKey: group ? chatKey(group) : ['chat'] });
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, userId, queryClient]);
}
