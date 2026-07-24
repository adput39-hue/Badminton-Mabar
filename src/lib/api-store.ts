import { useState, useEffect, useCallback } from "react";
import { getClientPbId } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";

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
    throw new Error(`API error: ${res.status}${text ? ` - ${text}` : ""}`);
  }
  return res.json();
}

export function useApi<T extends { id: string }>(resource: string, query = "") {
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
    const poll = setInterval(fetchData, 15_000);
    let lastFetch = Date.now();
    let rafId: number;
    function rafLoop() {
      const now = Date.now();
      if (now - lastFetch >= 15_000) { lastFetch = now; fetchData(); }
      rafId = requestAnimationFrame(rafLoop);
    }
    rafId = requestAnimationFrame(rafLoop);
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(poll); cancelAnimationFrame(rafId); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchData]);

  const refresh = useCallback(async () => {
    setLoaded(false);
    return fetchData();
  }, [fetchData]);

  const realtimeTable = TABLE_MAP[resource];
  useEffect(() => {
    if (!realtimeTable || !supabase) return;
    const channel = supabase
      .channel(`${resource}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: realtimeTable }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [resource, realtimeTable, refresh]);

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
