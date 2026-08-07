import { useState, useEffect, useCallback, useRef } from "react";
import { getClientPbId } from "@/lib/tenant";
import { getSupabase } from "@/lib/supabase";

const TABLE_MAP: Record<string, string> = {
  schedules: "schedules",
  matches: "matches",
  members: "members",
  attendances: "attendances",
  "match-history": "match_history",
  pbs: "pb",
  users: "users",
  "user-levels": "user_levels",
  "kas-mutasi": "kas_mutasi",
  "kas-biaya": "kas_biaya",
  "laba-rugi": "laba_rugi",
};

const SSE_MAP: Record<string, string> = {
  matches: "/api/matches/stream",
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const pbId = getClientPbId();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pbId) headers["x-pb-id"] = pbId;

  let res: Response;
  try {
    res = await fetch(url, { headers, ...options });
  } catch (e) {
    throw new Error("Network error");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error: ${res.status} ${options?.method || "GET"} ${url}${text ? ` - ${text}` : ""}`);
  }
  return res.json();
}

export function useApi<T extends { id: string }>(resource: string, query = "", refreshMs = 15000) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const url = `/api/${resource}${query}`;

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch<T[]>(url);
      setItems(data);
      return data;
    } catch (err) {
      console.error(err);
      return null as unknown as T[];
    } finally {
      setLoaded(true);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    if (refreshMs <= 0) return;
    const poll = setInterval(fetchData, refreshMs);
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchData, refreshMs]);

  const refresh = useCallback(async () => {
    return fetchData();
  }, [fetchData]);

  const realtimeTable = TABLE_MAP[resource];
  useEffect(() => {
    const sb = getSupabase();
    if (!realtimeTable || !sb) return;
    const channel = sb
      .channel(`${resource}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: realtimeTable }, () => {
        refresh();
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [resource, realtimeTable, refresh]);

  const sseUrl = SSE_MAP[resource];
  useEffect(() => {
    if (!sseUrl) return;
    const es = new EventSource(sseUrl);
    es.onmessage = () => { refresh(); };
    return () => es.close();
  }, [sseUrl, refresh]);

  const add = useCallback(
    async (data: Record<string, unknown>) => {
      const item = await apiFetch<T>(url, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setItems((prev) => [item, ...prev]);
      return item;
    },
    [url]
  );

  const baseUrl = `/api/${resource}`;

  const update = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      const item = await apiFetch<T>(`${baseUrl}/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setItems((prev) => prev.map((i) => (i.id === id ? item : i)));
      return item;
    },
    [baseUrl]
  );

  const remove = useCallback(
    async (id: string) => {
      await apiFetch(`${baseUrl}/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [baseUrl]
  );

  const getById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items]
  );

  const getWhere = useCallback(
    (predicate: (item: T) => boolean) => items.filter(predicate),
    [items]
  );

  return { items, loaded, refresh, add, update, remove, getById, getWhere };
}

export interface ControlData {
  schedules: import("./api-types").ApiSchedule[];
  members: import("./api-types").ApiMember[];
  matches: import("./api-types").ApiMatch[];
  tournaments: import("./api-types").ApiTournament[];
  teams: import("./api-types").ApiTeam[];
}

export function useControlData(refreshMs = 15000) {
  const [data, setData] = useState<ControlData>({ schedules: [], members: [], matches: [], tournaments: [], teams: [] });
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const result = await apiFetch<ControlData>("/api/control-data");
      setData(result);
      return result;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (refreshMs <= 0) return;
    timerRef.current = setInterval(fetchData, refreshMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData, refreshMs]);

  return { ...data, loaded, refresh: fetchData };
}
