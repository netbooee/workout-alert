import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import type { GroupMemberRow, MyGroup } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

function unwrap<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

export function useMyGroups() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['groups', 'mine', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyGroup[]> => unwrap(await supabase.rpc('my_groups', {})),
  });
}

/** Everyone in a group, most XP this week first. */
export function useGroupBoard(groupId: string) {
  return useQuery({
    queryKey: ['groups', 'board', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<GroupMemberRow[]> =>
      unwrap(await supabase.rpc('group_board', { p_group: groupId })),
  });
}

export function useGroupPreview(code: string) {
  return useQuery({
    queryKey: ['groups', 'preview', code],
    enabled: !!code,
    queryFn: async () => unwrap(await supabase.rpc('group_preview', { p_code: code }))[0] ?? null,
  });
}

function useGroupMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useCreateGroup() {
  return useGroupMutation(async ({ name, emoji }: { name: string; emoji: string }) =>
    unwrap(await supabase.rpc('create_group', { p_name: name, p_emoji: emoji })),
  );
}

export function useJoinGroup() {
  return useGroupMutation(async (code: string) => unwrap(await supabase.rpc('join_group', { p_code: code })));
}

export function useUpdateGroup() {
  return useGroupMutation(async ({ id, name, emoji }: { id: string; name: string; emoji: string }) =>
    unwrap(await supabase.rpc('update_group', { p_group: id, p_name: name, p_emoji: emoji })),
  );
}

export function useLeaveGroup() {
  return useGroupMutation(async (id: string) => {
    const { error } = await supabase.rpc('leave_group', { p_group: id });
    if (error) throw error;
  });
}

export function useRemoveGroupMember() {
  return useGroupMutation(async ({ group, user }: { group: string; user: string }) => {
    const { error } = await supabase.rpc('remove_group_member', { p_group: group, p_user: user });
    if (error) throw error;
  });
}
