"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiSchedule, ApiAttendance, ApiMember } from "@/lib/api-types";
import { Wallet, Pencil, X, Check, Save, Search, DollarSign } from "lucide-react";

function getPaidMembers(schedule: ApiSchedule): string[] {
  if (!schedule.notes) return [];
  try {
    const parsed = JSON.parse(schedule.notes);
    if (Array.isArray(parsed.paidMembers)) return parsed.paidMembers;
  } catch {}
  return [];
}

function setPaidMembers(schedule: ApiSchedule, memberIds: string[]): string {
  if (!schedule.notes) return JSON.stringify({ paidMembers: memberIds });
  try {
    const parsed = JSON.parse(schedule.notes);
    parsed.paidMembers = memberIds;
    return JSON.stringify(parsed);
  } catch {
    return JSON.stringify({ text: schedule.notes, paidMembers: memberIds });
  }
}

export default function BayarHtmPage() {
  const { items: schedules, update: updateSchedule } = useApi<ApiSchedule>("schedules");
  const { items: attendances } = useApi<ApiAttendance>("attendances");
  const { items: members } = useApi<ApiMember>("members");

  const [expandId, setExpandId] = useState<string | null>(null);
  const [paidState, setPaidState] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");

  const internalMembers = useMemo(() => members.filter((m) => m.type === "1" || !m.type), [members]);

  const htmSchedules = useMemo(() => {
    return schedules
      .filter((s) => s.htm && s.htm > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [schedules]);

  function getHadirMembers(scheduleId: string) {
    const attIds = attendances.filter((a) => a.scheduleId === scheduleId && a.status === "hadir").map((a) => a.memberId);
    return internalMembers.filter((m) => attIds.includes(m.id) || scheduleId.includes(m.id));
  }

  function getParticipantMembers(scheduleId: string): ApiMember[] {
    const attIds = attendances.filter((a) => a.scheduleId === scheduleId && (a.status === "hadir" || a.status === "undangan")).map((a) => a.memberId);
    const matched = internalMembers.filter((m) => attIds.includes(m.id));
    if (matched.length > 0) return matched.sort((a, b) => a.name.localeCompare(b.name));
    const fallback = internalMembers.filter((m) => {
      const mAtts = attendances.filter((a) => a.memberId === m.id && a.status === "hadir");
      return mAtts.some((a) => schedules.find((s) => s.id === a.scheduleId && s.htm && s.htm > 0));
    });
    return fallback.slice(0, 20);
  }

  function togglePaid(scheduleId: string, memberId: string) {
    setPaidState((prev) => {
      const current = prev[scheduleId] || getPaidMembers(htmSchedules.find((s) => s.id === scheduleId)!);
      const updated = current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [scheduleId]: updated };
    });
  }

  async function savePaid(scheduleId: string) {
    const s = htmSchedules.find((x) => x.id === scheduleId);
    if (!s) return;
    const paidIds = paidState[scheduleId] || getPaidMembers(s);
    const newNotes = setPaidMembers(s, paidIds);
    await updateSchedule(scheduleId, { notes: newNotes });
    setExpandId(null);
  }

  function openExpand(scheduleId: string) {
    const s = htmSchedules.find((x) => x.id === scheduleId);
    if (!s) return;
    setPaidState((prev) => ({ ...prev, [scheduleId]: getPaidMembers(s) }));
    setExpandId(scheduleId);
  }

  const filtered = htmSchedules.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.sparingOpponent || "").toLowerCase().includes(q);
  });

  const totalPaid = useMemo(() => {
    let count = 0;
    for (const s of htmSchedules) {
      count += getPaidMembers(s).length;
    }
    return count;
  }, [htmSchedules]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bayar HTM</h1>
          <p className="mt-0.5 text-sm text-gray-500">{htmSchedules.length} jadwal dengan HTM &middot; {totalPaid} pemain sudah bayar</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari jadwal..." className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pl-10 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
        </div>
      </div>

      {htmSchedules.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Wallet className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada jadwal dengan HTM</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const paidIds = getPaidMembers(s);
            const peserta = getParticipantMembers(s.id);
            const paid = paidState[s.id] || paidIds;
            const isOpen = expandId === s.id;
            return (
              <div key={s.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d9488]/10">
                      <DollarSign className="h-5 w-5 text-[#0d9488]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-900 sm:text-base">
                        {s.sparingOpponent ? `Sparing vs ${s.sparingOpponent}` : s.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        {s.sparingOpponent && " \u2022 Sparing"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0d9488]">Rp {s.htm!.toLocaleString("id-ID")}</p>
                      <p className="text-xs text-gray-400">{peserta.length} pemain &middot; {paidIds.length} bayar</p>
                    </div>
                    {isOpen ? (
                      <button onClick={() => setExpandId(null)} className="rounded-xl border border-gray-200 p-2.5 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                    ) : (
                      <button onClick={() => openExpand(s.id)} className="rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-[#ccfbf1] hover:text-[#0d9488]"><Pencil className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-5 pt-4 sm:px-5">
                    <h4 className="mb-3 text-sm font-semibold text-gray-700">Daftar Pemain</h4>
                    {peserta.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">Belum ada peserta terdaftar</p>
                    ) : (
                      <div className="space-y-1">
                        {peserta.map((m) => (
                          <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${paid.includes(m.id) ? "border-[#0d9488] bg-[#0d9488]" : "border-gray-300"}`}>
                              {paid.includes(m.id) && <Check className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <span className="flex-1 text-sm font-medium text-gray-900">{m.name}</span>
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-600">{m.class}</span>
                            {paid.includes(m.id) && <span className="text-xs font-semibold text-[#0d9488]">Lunas</span>}
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                      <p className="text-sm text-gray-500">{paid.filter((id) => peserta.some((p) => p.id === id)).length} / {peserta.length} sudah bayar</p>
                      <div className="flex gap-2">
                        <button onClick={() => setExpandId(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                        <button onClick={() => savePaid(s.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e]"><Save className="h-3.5 w-3.5" /> Simpan</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
