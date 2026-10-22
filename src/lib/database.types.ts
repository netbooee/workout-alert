// Hand-maintained to match supabase/migrations. Once you have a linked
// project you can regenerate this with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type ReactionKind = 'fire' | 'strong' | 'clap' | 'verified';
export type IncentiveGoalKind = 'workout_days' | 'active_minutes' | 'workouts' | 'streak_weeks';
export type IncentiveStatus =
  | 'offered'
  | 'active'
  | 'earned'
  | 'delivered'
  | 'declined'
  | 'cancelled'
  | 'expired';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          weekly_goal: number;
          min_workout_minutes: number;
          /** Shortest walk that counts; null means the same as min_workout_minutes. */
          min_walk_minutes: number | null;
          count_walks: boolean;
          onboarded_at: string | null;
          invite_code: string;
          notify_nudges: boolean;
          notify_partner_workouts: boolean;
          notify_partner_requests: boolean;
          notify_verifications: boolean;
          notify_comments: boolean;
          notify_incentives: boolean;
          notify_streak_reminders: boolean;
          resting_since: string | null;
          mascot: 'lotl' | 'capybara' | 'sloth' | 'red_panda';
          created_at: string;
        };
        Insert: never;
        Update: {
          notify_nudges?: boolean;
          notify_partner_workouts?: boolean;
          notify_partner_requests?: boolean;
          notify_verifications?: boolean;
          notify_comments?: boolean;
          notify_incentives?: boolean;
          notify_streak_reminders?: boolean;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          weekly_goal?: number;
          min_workout_minutes?: number;
          min_walk_minutes?: number | null;
          count_walks?: boolean;
          onboarded_at?: string | null;
          mascot?: 'lotl' | 'capybara' | 'sloth' | 'red_panda';
        };
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          source: 'healthkit' | 'manual';
          external_id: string | null;
          activity_type: string;
          started_at: string;
          ended_at: string;
          duration_s: number;
          active_kcal: number | null;
          distance_m: number | null;
          avg_hr: number | null;
          max_hr: number | null;
          note: string | null;
          photo_paths: string[];
          source_name: string | null;
          /** Set when another device recorded the same workout; points at the copy that counts. */
          duplicate_of: string | null;
          /** Meets the owner's "What counts" rules (set by the database). */
          counted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          source?: 'healthkit' | 'manual';
          external_id?: string | null;
          activity_type: string;
          started_at: string;
          ended_at: string;
          duration_s: number;
          active_kcal?: number | null;
          distance_m?: number | null;
          avg_hr?: number | null;
          max_hr?: number | null;
          note?: string | null;
          photo_paths?: string[];
          source_name?: string | null;
        };
        Update: Partial<Database['public']['Tables']['workouts']['Insert']>;
        Relationships: [];
      };
      daily_activity: {
        Row: {
          user_id: string;
          day: string;
          steps: number | null;
          active_kcal: number | null;
          exercise_min: number | null;
          resting_hr: number | null;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          day: string;
          steps?: number | null;
          active_kcal?: number | null;
          exercise_min?: number | null;
          resting_hr?: number | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daily_activity']['Insert']>;
        Relationships: [];
      };
      streaks: {
        Row: {
          user_id: string;
          current_weeks: number;
          longest_weeks: number;
          freezes_banked: number;
          this_week_start: string | null;
          this_week_days: number;
          this_week_goal: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      streak_weeks: {
        Row: {
          user_id: string;
          week_start: string;
          active_days: number;
          goal: number;
          status: 'hit' | 'frozen' | 'missed' | 'in_progress' | 'rest';
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      legacy_week_hits: {
        Row: {
          user_id: string;
          week_start: string;
          goal: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      partnerships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted';
          created_at: string;
          accepted_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reactions: {
        Row: {
          workout_id: string;
          user_id: string;
          kind: ReactionKind;
          created_at: string;
        };
        Insert: { workout_id: string; user_id?: string; kind: ReactionKind };
        Update: never;
        Relationships: [];
      };
      incentives: {
        Row: {
          id: string;
          from_id: string;
          to_id: string;
          goal_kind: IncentiveGoalKind;
          goal_target: number;
          activity_type: string | null;
          weeks: number;
          starts_at: string;
          ends_at: string;
          reward: string;
          reward_emoji: string;
          verified_only: boolean;
          status: IncentiveStatus;
          progress: number;
          created_at: string;
          responded_at: string | null;
          earned_at: string | null;
          delivered_at: string | null;
          /** The offering partner's rules and notes, if any. */
          notes: string | null;
          /** Shared quest: both partners' workouts count, and both earn the reward. */
          shared: boolean;
          /** The giver's share of `progress` (always 0 unless shared). */
          from_progress: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      workout_comments: {
        Row: {
          id: string;
          workout_id: string;
          user_id: string;
          body: string | null;
          audio_path: string | null;
          audio_duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          workout_id: string;
          user_id?: string;
          body?: string | null;
          audio_path?: string | null;
          audio_duration_ms?: number | null;
        };
        Update: never;
        Relationships: [];
      };
      nudges: {
        Row: {
          id: string;
          from_id: string;
          to_id: string;
          created_at: string;
          seen_at: string | null;
        };
        Insert: never;
        Update: { seen_at?: string | null };
        Relationships: [];
      };
      league_players: {
        Row: {
          user_id: string;
          opted_in: boolean;
          tier: number;
          nickname: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      xp_events: {
        Row: {
          user_id: string;
          kind: 'workout' | 'evidence' | 'week_goal' | 'incentive' | 'verified' | 'verifier' | 'steps';
          ref: string;
          amount: number;
          created_at: string;
          awarded_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      push_tokens: {
        Row: { token: string; user_id: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: 'nudge' | 'partner_workout' | 'partner_request' | 'partner_accepted' | 'verified' | 'streak_risk' | 'comment' | 'incentive';
          title: string;
          body: string;
          url: string | null;
          dedupe_key: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      refresh_my_streak: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['streaks']['Row'];
      };
      request_partner: {
        Args: { p_code: string };
        Returns: Database['public']['Tables']['partnerships']['Row'];
      };
      respond_to_partner: {
        Args: { p_id: string; p_accept: boolean };
        Returns: undefined;
      };
      set_rest_mode: {
        Args: { p_on: boolean };
        Returns: undefined;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      register_push_token: {
        Args: { p_token: string };
        Returns: undefined;
      };
      unregister_push_token: {
        Args: { p_token: string };
        Returns: undefined;
      };
      offer_incentive: {
        Args: {
          p_to: string;
          p_goal_kind: IncentiveGoalKind;
          p_goal_target: number;
          p_weeks: number;
          p_reward: string;
          p_reward_emoji?: string;
          p_activity_type?: string | null;
          p_verified_only?: boolean;
          p_notes?: string | null;
          p_shared?: boolean;
        };
        Returns: Database['public']['Tables']['incentives']['Row'];
      };
      respond_to_incentive: {
        Args: { p_id: string; p_accept: boolean };
        Returns: Database['public']['Tables']['incentives']['Row'];
      };
      cancel_incentive: {
        Args: { p_id: string };
        Returns: Database['public']['Tables']['incentives']['Row'];
      };
      mark_incentive_delivered: {
        Args: { p_id: string };
        Returns: Database['public']['Tables']['incentives']['Row'];
      };
      nudge_partner: {
        Args: { p_partner: string };
        Returns: Database['public']['Tables']['nudges']['Row'];
      };
      my_partners: {
        Args: Record<PropertyKey, never>;
        Returns: {
          partnership_id: string;
          partner_id: string;
          display_name: string | null;
          avatar_url: string | null;
          status: 'pending' | 'accepted';
          incoming: boolean;
          current_weeks: number;
          this_week_days: number;
          this_week_goal: number;
          friend_streak: number;
          last_nudged_at: string | null;
          mascot: 'lotl' | 'capybara' | 'sloth' | 'red_panda';
          resting: boolean;
        }[];
      };
      set_public_league: {
        Args: { p_on: boolean; p_nickname?: string | null };
        Returns: Database['public']['Tables']['league_players']['Row'];
      };
      my_public_league: {
        Args: { p_now?: string };
        Returns: {
          member_key: string;
          name: string;
          mascot: 'lotl' | 'capybara' | 'sloth' | 'red_panda';
          xp: number;
          rank: number;
          is_me: boolean;
          tier: number;
          week_start: string;
          group_size: number;
        }[];
      };
      my_league_result: {
        Args: Record<PropertyKey, never>;
        Returns: {
          week_start: string;
          final_rank: number;
          final_xp: number;
          result: 'up' | 'stay' | 'down';
          tier: number;
          group_size: number;
        }[];
      };
      my_league_result_table: {
        Args: Record<PropertyKey, never>;
        Returns: {
          member_key: string;
          name: string;
          mascot: 'lotl' | 'capybara' | 'sloth' | 'red_panda';
          xp: number;
          rank: number;
          is_me: boolean;
          result: 'up' | 'stay' | 'down';
        }[];
      };
      mark_league_result_seen: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      report_league_member: {
        Args: { p_member_key: string; p_reason?: string | null };
        Returns: undefined;
      };
      weekly_league: {
        Args: { p_now?: string };
        Returns: {
          user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          xp: number;
          is_me: boolean;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database['public']['Tables'];
export type Profile = PublicTables['profiles']['Row'];
export type Workout = PublicTables['workouts']['Row'];
export type DailyActivity = PublicTables['daily_activity']['Row'];
export type Streak = PublicTables['streaks']['Row'];
export type StreakWeek = PublicTables['streak_weeks']['Row'];
export type Reaction = PublicTables['reactions']['Row'];
export type WorkoutComment = PublicTables['workout_comments']['Row'];
export type Incentive = PublicTables['incentives']['Row'];
export type Nudge = PublicTables['nudges']['Row'];
export type XpEvent = PublicTables['xp_events']['Row'];
export type Partner = Database['public']['Functions']['my_partners']['Returns'][number];
export type LeagueRow = Database['public']['Functions']['weekly_league']['Returns'][number];
export type LeaguePlayer = PublicTables['league_players']['Row'];
export type PublicLeagueRow = Database['public']['Functions']['my_public_league']['Returns'][number];
export type LeagueResult = Database['public']['Functions']['my_league_result']['Returns'][number];
