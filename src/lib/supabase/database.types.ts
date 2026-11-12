/**
 * Types for the tables in /supabase/migrations, in the shape that
 * `supabase gen types typescript` produces. Regenerate (or edit by hand) when a
 * migration changes a table:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */
export interface Database {
  public: {
    Tables: {
      meals: {
        Row: {
          id: string;
          user_id: string;
          eaten_at: string;
          meal_type: string;
          name: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          fiber_g: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          eaten_at?: string;
          meal_type?: string;
          name: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          fiber_g?: number;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meals"]["Insert"]>;
        Relationships: [];
      };
      settings: {
        Row: {
          user_id: string;
          calorie_goal: number;
          protein_goal: number;
          carbs_goal: number;
          fat_goal: number;
          fiber_goal: number;
          sex: string | null;
          birth_year: number | null;
          height_cm: number | null;
          activity_level: string | null;
          goal: string | null;
          weekly_rate_kg: number | null;
          units: string;
          profile_completed_at: string | null;
        };
        Insert: {
          user_id?: string;
          calorie_goal?: number;
          protein_goal?: number;
          carbs_goal?: number;
          fat_goal?: number;
          fiber_goal?: number;
          sex?: string | null;
          birth_year?: number | null;
          height_cm?: number | null;
          activity_level?: string | null;
          goal?: string | null;
          weekly_rate_kg?: number | null;
          units?: string;
          profile_completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
      live_usage: {
        Row: {
          user_id: string;
          day: string;
          tokens: number;
        };
        // Shape only: there are no insert/update policies, so writes go through claim_live_token().
        Insert: {
          user_id: string;
          day: string;
          tokens?: number;
        };
        Update: Partial<Database["public"]["Tables"]["live_usage"]["Insert"]>;
        Relationships: [];
      };
      weights: {
        Row: {
          id: string;
          user_id: string;
          measured_on: string;
          weight_kg: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          measured_on: string;
          weight_kg: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weights"]["Insert"]>;
        Relationships: [];
      };
      saved_foods: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          meal_type: string | null;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          fiber_g: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          meal_type?: string | null;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          fiber_g?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_foods"]["Insert"]>;
        Relationships: [];
      };
      ai_usage: {
        Row: {
          user_id: string;
          day: string;
          kind: string;
          count: number;
        };
        // Shape only: written through claim_ai_usage().
        Insert: {
          user_id: string;
          day: string;
          kind: string;
          count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      claim_live_token: {
        Args: Record<string, never>;
        Returns: number;
      };
      claim_ai_usage: {
        Args: { p_kind: string };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type MealRow = Database["public"]["Tables"]["meals"]["Row"];
export type MealInsert = Database["public"]["Tables"]["meals"]["Insert"];
export type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
export type WeightRow = Database["public"]["Tables"]["weights"]["Row"];
export type SavedFoodRow = Database["public"]["Tables"]["saved_foods"]["Row"];
