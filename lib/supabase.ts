import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type MeetingRow = {
  id: string;
  created_at: string;
  status: "pending" | "processing" | "ready" | "error";
  transcript: string | null;
  summary: string | null;
  audio_path: string | null;
  user_id: string | null;
};
