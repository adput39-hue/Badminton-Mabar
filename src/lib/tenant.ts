export function getClientPbId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user.pbId || null;
  } catch {
    return null;
  }
}
