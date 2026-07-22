import { useState, useEffect, useCallback } from "react";
import { getClientPbId } from "@/lib/tenant";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const pbId = getClientPbId();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pbId) headers["x-pb-id"] = pbId;

  const res = await fetch(url, {
    headers,
    ...options,
  });
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

  useEffect(() => {
    apiFetch<T[]>(url)
      .then((data) => setItems(data))
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [url]);

  const refresh = useCallback(async () => {
    const data = await apiFetch<T[]>(url);
    setItems(data);
    return data;
  }, [url]);

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
