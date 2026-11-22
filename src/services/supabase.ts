import { createClient } from "@supabase/supabase-js";

type ReadingRow = {
  id: number;
  user_id: string;
  device_id: string;
  observed_at: string;
  valid: boolean;
  co2: number;
  temperature: number;
  humidity: number;
  quality: string;
  display_theme: "light" | "dark";
  fan_on: boolean;
  fan_mode: "auto" | "on" | "off";
  muted: boolean;
  alarm_active: boolean;
  system_on: boolean;
  uptime_seconds: number;
  last_reading_uptime: number;
  last_reading_epoch: number;
};

type ReadingInsert = Omit<ReadingRow, "id" | "user_id" | "observed_at"> & {
  id?: number;
  user_id?: string;
  observed_at?: string;
};

export type Database = {
  public: {
    Tables: {
      airwatch_readings: {
        Row: ReadingRow;
        Insert: ReadingInsert;
        Update: Partial<ReadingInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Cloud sync is not configured. Add the Supabase URL and anon key, then rebuild.");
  }
  return supabase;
}
