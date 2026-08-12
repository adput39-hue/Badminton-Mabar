export function toDateOnly(value: string | number | Date): string {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => {
    if (word.length <= 1) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function getNotesText(notes: string | null | undefined): string {
  if (!notes) return "";
  try { const o = JSON.parse(notes); return typeof o?.text === "string" ? o.text : notes; } catch { return notes; }
}

export function getGameTarget(format: string): number {
  if (format.startsWith("1-42")) return 42;
  if (format.startsWith("2-21")) return 21;
  return 30;
}

export function getGameWinner(s1: number, s2: number, target: number): 1 | 2 | null {
  if (s1 >= target && s1 - s2 >= 2) return 1;
  if (s2 >= target && s2 - s1 >= 2) return 2;
  if (s1 >= 30 || s2 >= 30) return s1 > s2 ? 1 : s2 > s1 ? 2 : null;
  return null;
}
