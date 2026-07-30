export function getClientPbId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const urlPbId = params.get("pbId");
    if (urlPbId) return urlPbId;

    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user.pbId || null;
  } catch {
    return null;
  }
}
