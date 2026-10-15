import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import type { Database, Incentive } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

const key = ['social', 'incentives'];

/** Every incentive you gave or received (RLS limits it to those), newest first. */
export function useIncentives() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: [...key, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incentives')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useIncentive(id: string) {
  const { data, ...rest } = useIncentives();
  return { data: data?.find((i) => i.id === id), ...rest };
}

/** Split into what you received and what you gave. */
export function useMyIncentives() {
  const me = useAuth().session?.user.id;
  const { data } = useIncentives();
  const all = data ?? [];
  return {
    received: all.filter((i) => i.to_id === me),
    given: all.filter((i) => i.from_id === me),
  };
}

type Fn = Database['public']['Functions'];

function useIncentiveRpc<A>(call: (args: A) => PromiseLike<{ data: Incentive | null; error: unknown }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: A) => {
      const { data, error } = await call(args);
      if (error) throw error;
      return data as Incentive;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['social'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ]),
  });
}

export const useOfferIncentive = () =>
  useIncentiveRpc((args: Fn['offer_incentive']['Args']) => supabase.rpc('offer_incentive', args));

export const useRespondToIncentive = () =>
  useIncentiveRpc((args: { id: string; accept: boolean }) =>
    supabase.rpc('respond_to_incentive', { p_id: args.id, p_accept: args.accept }),
  );

export const useCancelIncentive = () =>
  useIncentiveRpc((id: string) => supabase.rpc('cancel_incentive', { p_id: id }));

export const useMarkIncentiveDelivered = () =>
  useIncentiveRpc((id: string) => supabase.rpc('mark_incentive_delivered', { p_id: id }));
