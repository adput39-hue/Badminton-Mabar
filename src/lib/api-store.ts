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

function getCacheKey(url: string) {
  try {
    const pbId = getClientPbId();
    return "api_cache_" + (pbId || "") + "_" + url.replace(/[^a-zA-Z0-9]/g, "_");
  } catch { return "api_cache_" + url.replace(/[^a-zA-Z0-9]/g, "_"); }
}

function loadCache<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCache<T>(key: string, data: T[]) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function clearCache() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("api_cache_"));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
}

export function useApi<T extends { id: string }>(resource: string, query = "") {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const url = `/api/${resource}${query}`;
  const cacheKey = getCacheKey(url);

  useEffect(() => {
    const cached = loadCache<T>(cacheKey);
    if (cached) {
      setItems(cached);
      setLoaded(true);
      // refresh from API in background (stale-while-revalidate)
      apiFetch<T[]>(url)
        .then((data) => { setItems(data); saveCache(cacheKey, data); })
        .catch(() => {});
      return;
    }
    apiFetch<T[]>(url)
      .then((data) => { setItems(data); saveCache(cacheKey, data); })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [url, cacheKey]);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<T[]>(url);
      setItems(data);
      saveCache(cacheKey, data);
      return data;
    } catch {
      return null as unknown as T[];
    }
  }, [url, cacheKey]);

  const realtimeTable = TABLE_MAP[resource];
  useEffect(() => {
    if (!realtimeTable) return;
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
      clearCache();
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
      clearCache();
      return item;
    },
    [baseUrl]
  );

  const remove = useCallback(
    async (id: string) => {
      await apiFetch(`${baseUrl}/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
      clearCache();
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
