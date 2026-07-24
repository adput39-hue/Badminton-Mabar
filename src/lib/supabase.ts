import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof window === "undefined" || !supabaseUrl || !supabaseAnonKey) {
    return null as unknown as ReturnType<typeof createClient>;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export const supabase = createSupabaseClient();

export type RealtimePayload<T = Record<string, unknown>> = {
  new: T;
  old: T;
  eventType: "INSERT" | "UPDATE" | "DELETE";
};
