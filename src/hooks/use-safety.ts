import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionSheetIOS, Alert } from 'react-native';

import { useAuth } from '@/lib/auth';
import type { ReportKind, ReportReason } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'inappropriate', label: 'Inappropriate photo, video or words' },
  { key: 'spam', label: 'Spam or a fake account' },
  { key: 'other', label: 'Something else' },
];

export interface SafetyTarget {
  userId: string;
  /** First name, for the prompts. */
  name: string;
  /** What's being reported; 'user' for the person themselves. */
  kind: ReportKind;
  refId?: string | null;
  /** After blocking, e.g. leave their page. */
  onBlocked?: () => void;
  /** One more choice at the top of the menu, like "Delete comment" or "Remove from group". */
  extra?: { label: string; onPress: () => void };
}

/** People you've blocked, newest first. */
export function useBlocks() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['blocks', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_blocks');
      if (error) throw error;
      return data;
    },
  });
}

export function useUnblock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('unblock_user', { p_user: userId });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  });
}

/**
 * Report or block someone, from a "•••" button or a long press: an action
 * sheet with Report (then a reason) and Block, each confirmed. Blocking ends
 * the partnership and stops requests, nudges and pep talks both ways.
 */
export function useSafetyMenu() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries();

  const block = (t: SafetyTarget) =>
    Alert.alert(
      `Block ${t.name}?`,
      'You’ll stop being partners, and neither of you can send the other partner requests, nudges or pep talks. They won’t be told. You can unblock in Me → Settings → Privacy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('block_user', { p_user: t.userId });
            if (error) {
              Alert.alert('Couldn’t block', friendlyError(error));
              return;
            }
            await refresh();
            t.onBlocked?.();
          },
        },
      ],
    );

  const report = (t: SafetyTarget) => {
    const options = [...REASONS.map((r) => r.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Why are you reporting this?', options, cancelButtonIndex: options.length - 1 },
      async (i) => {
        const reason = REASONS[i];
        if (!reason) return;
        const { error } = await supabase.rpc('report_content', {
          p_user: t.userId,
          p_kind: t.kind,
          p_ref: t.refId ?? null,
          p_reason: reason.key,
        });
        if (error) {
          Alert.alert('Couldn’t send the report', friendlyError(error));
          return;
        }
        Alert.alert('Thanks for telling us', `We review reports within 24 hours. Do you also want to block ${t.name}?`, [
          { text: 'Not now', style: 'cancel' },
          { text: `Block ${t.name}`, style: 'destructive', onPress: () => block(t) },
        ]);
      },
    );
  };

  return (t: SafetyTarget) => {
    const what = t.kind === 'user' ? t.name : t.kind === 'comment' ? 'this comment' : t.kind === 'pep_talk' ? 'this pep talk' : 'this workout';
    const offset = t.extra ? 1 : 0;
    const options = [...(t.extra ? [t.extra.label] : []), `Report ${what}`, `Block ${t.name}`, 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: [offset + 1] },
      (i) => {
        if (t.extra && i === 0) t.extra.onPress();
        else if (i === offset) report(t);
        else if (i === offset + 1) block(t);
      },
    );
  };
}
