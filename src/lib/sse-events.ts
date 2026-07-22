type Listener = (data: string) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function broadcast(data: string) {
  for (const l of listeners) {
    try { l(data); } catch { listeners.delete(l); }
  }
}
