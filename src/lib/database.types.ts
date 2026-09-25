// Hand-maintained to match supabase/migrations. Once you have a linked
// project you can regenerate this with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type ReactionKind = 'fire' | 'strong' | 'clap' | 'verified';

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
          onboarded_at: string | null;
          invite_code: string;
          created_at: string;
        };
        Insert: never;
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          weekly_goal?: number;
          min_workout_minutes?: number;
          onboarded_at?: string | null;
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
          status: 'hit' | 'frozen' | 'missed' | 'in_progress';
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
      xp_events: {
        Row: {
          user_id: string;
          kind: 'workout' | 'evidence' | 'week_goal';
          ref: string;
          amount: number;
          created_at: string;
          awarded_at: string;
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
        }[];
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
export type Nudge = PublicTables['nudges']['Row'];
export type XpEvent = PublicTables['xp_events']['Row'];
export type Partner = Database['public']['Functions']['my_partners']['Returns'][number];
export type LeagueRow = Database['public']['Functions']['weekly_league']['Returns'][number];
