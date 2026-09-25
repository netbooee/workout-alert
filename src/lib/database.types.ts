// Hand-maintained to match supabase/migrations. Once you have a linked
// project you can regenerate this with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

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
    };
    Views: { [_ in never]: never };
    Functions: {
      refresh_my_streak: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['streaks']['Row'];
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
