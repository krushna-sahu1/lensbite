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
        };
        Insert: {
          user_id?: string;
          calorie_goal?: number;
          protein_goal?: number;
          carbs_goal?: number;
          fat_goal?: number;
          fiber_goal?: number;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type MealRow = Database["public"]["Tables"]["meals"]["Row"];
export type MealInsert = Database["public"]["Tables"]["meals"]["Insert"];
export type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
