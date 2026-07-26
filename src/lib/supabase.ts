import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (_supabase) return _supabase;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof window === "undefined" || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return _supabase;
}

export type RealtimePayload<T = Record<string, unknown>> = {
  new: T;
  old: T;
  eventType: "INSERT" | "UPDATE" | "DELETE";
};
