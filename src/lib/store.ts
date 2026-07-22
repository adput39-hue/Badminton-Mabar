import { useState, useEffect, useCallback } from "react";

function generateId(): string {
  return crypto.randomUUID();
}

function getAll<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function saveAll<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function useStore<T extends { id: string }>(key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(getAll<T>(key));
    setLoaded(true);
  }, [key]);

  const persist = useCallback(
    (newItems: T[]) => {
      setItems(newItems);
      saveAll(key, newItems);
    },
    [key]
  );

  const add = useCallback(
    (item: Omit<T, "id">) => {
      const newItem = { ...item, id: generateId() } as unknown as T;
      persist([...items, newItem]);
      return newItem;
    },
    [items, persist]
  );

  const update = useCallback(
    (id: string, updates: Partial<T>) => {
      persist(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    },
    [items, persist]
  );

  const remove = useCallback(
    (id: string) => {
      persist(items.filter((item) => item.id !== id));
    },
    [items, persist]
  );

  const getById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items]
  );

  const getWhere = useCallback(
    (predicate: (item: T) => boolean) => items.filter(predicate),
    [items]
  );

  return { items, loaded, add, update, remove, getById, getWhere };
}

export function getAllItems<T>(key: string): T[] {
  return getAll<T>(key);
}
