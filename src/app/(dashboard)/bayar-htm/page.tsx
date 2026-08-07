"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiSchedule, ApiAttendance, ApiMember, ApiKasMutasi, ApiMatch } from "@/lib/api-types";
import { Wallet, Pencil, X, Check, Save, Search, DollarSign, Lock, Loader2 } from "lucide-react";
import { getClientPbId } from "@/lib/tenant";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/components/toast";
import { getHtmRate } from "@/lib/htm-rate";

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

function getHtmLocked(schedule: ApiSchedule): boolean {
  if (!schedule.notes) return false;
  try { const p = JSON.parse(schedule.notes); return p.htmLocked === true; } catch { return false; }
}

function toggleHtmLocked(schedule: ApiSchedule): string {
  const parsed = schedule.notes ? JSON.parse(schedule.notes) : {};
  parsed.htmLocked = !parsed.htmLocked;
  return JSON.stringify(parsed);
}

export default function BayarHtmPage() {
  const { toast } = useToast();
  const { items: schedules, update: updateSchedule, loaded: schedulesLoaded } = useApi<ApiSchedule>("schedules");
  const { items: attendances, loaded: attendancesLoaded } = useApi<ApiAttendance>("attendances");
  const { items: members, loaded: membersLoaded } = useApi<ApiMember>("members");
  const { items: mutasis, loaded: mutasisLoaded } = useApi<ApiKasMutasi>("kas-mutasi");
  const { items: matches, loaded: matchesLoaded } = useApi<ApiMatch>("matches");

  const [expandId, setExpandId] = useState<string | null>(null);
  const [paidState, setPaidState] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);

  const internalMembers = useMemo(() => members.filter((m) => m.type === "1" || !m.type), [members]);

  const htmSchedules = useMemo(() => {
    return schedules
      .filter((s) => ((s.htm && s.htm > 0) || (s.htmInsidentil && s.htmInsidentil > 0)) && s.status !== "cancelled")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [schedules]);

  function getParticipantMembers(scheduleId: string): ApiMember[] {
    const attIds = attendances.filter((a) => a.scheduleId === scheduleId && (a.status === "hadir" || a.status === "undangan")).map((a) => a.memberId);
    const matched = internalMembers.filter((m) => attIds.includes(m.id));
    if (matched.length > 0) return matched.sort((a, b) => a.name.localeCompare(b.name));
    const fallback = internalMembers.filter((m) => {
      const mAtts = attendances.filter((a) => a.memberId === m.id && a.status === "hadir");
      return mAtts.some((a) => schedules.find((s) => s.id === a.scheduleId && ((s.htm && s.htm > 0) || (s.htmInsidentil && s.htmInsidentil > 0))));
    });
    return fallback.slice(0, 20);
  }

  function getPlayerCockCost(scheduleId: string, memberId: string): { totalCocks: number; cost: number } {
    const schedule = htmSchedules.find((s) => s.id === scheduleId);
    if (!schedule || !schedule.cockPrice) return { totalCocks: 0, cost: 0 };
    const playerMatches = matches.filter(
      (m) => m.scheduleId === scheduleId && m.status === "completed" && m.cockCount && m.cockCount > 0
        && (m.team1Player1Id === memberId || m.team1Player2Id === memberId || m.team2Player1Id === memberId || m.team2Player2Id === memberId)
    );
    const totalCocks = playerMatches.reduce((sum, m) => sum + (m.cockCount || 0), 0);
    return { totalCocks, cost: totalCocks * (schedule.cockPrice || 0) };
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

  function checkAllUnpaid(scheduleId: string) {
    const s = htmSchedules.find((x) => x.id === scheduleId);
    if (!s) return;
    const current = paidState[scheduleId] || getPaidMembers(s);
    const peserta = getParticipantMembers(scheduleId);
    const allIds = [...new Set([...current, ...peserta.map((m) => m.id)])];
    setPaidState((prev) => ({ ...prev, [scheduleId]: allIds }));
  }

  async function savePaid(scheduleId: string) {
    setSavingScheduleId(scheduleId);
    try {
      const s = htmSchedules.find((x) => x.id === scheduleId);
      if (!s) return;
      const paidIds = paidState[scheduleId] || getPaidMembers(s);
      const oldPaidIds = getPaidMembers(s);
      const newNotes = setPaidMembers(s, paidIds);
      await updateSchedule(scheduleId, { notes: newNotes });

      const pbId = getClientPbId();
      const existingMutasis = mutasis.filter((m) => m.reference === scheduleId && m.description?.startsWith("Bayar HTM"));

      for (const memberId of paidIds) {
        const member = members.find((m) => m.id === memberId);
        if (!member) continue;
        const cock = getPlayerCockCost(scheduleId, memberId);
        const rate = getHtmRate(s, member);
        const totalAmount = rate + cock.cost;
        const desc = `Bayar HTM - ${member?.name || "?"} - ${s.sparingOpponent ? `Sparing vs ${s.sparingOpponent}` : s.title}${cock.cost ? ` (HTM Rp${rate.toLocaleString("id-ID")} + Cock ${cock.totalCocks}bh Rp${cock.cost.toLocaleString("id-ID")})` : ""}`;
        const existing = existingMutasis.find((m) => m.memberId === memberId);
        if (existing) {
          await fetch("/api/kas-mutasi/" + existing.id, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-pb-id": pbId || "" },
            body: JSON.stringify({ amount: totalAmount, description: desc, void: 0 }),
          });
        } else {
          await fetch("/api/kas-mutasi", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-pb-id": pbId || "" },
            body: JSON.stringify({ type: "masuk", amount: totalAmount, description: desc, reference: scheduleId, scheduleId, memberId, tanggal: new Date().toISOString() }),
          });
        }
      }

      const removedIds = oldPaidIds.filter((id) => !paidIds.includes(id));
      for (const memberId of removedIds) {
        const existing = existingMutasis.find((m) => m.memberId === memberId);
        if (existing) {
          await fetch("/api/kas-mutasi/" + existing.id, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-pb-id": pbId || "" },
            body: JSON.stringify({ void: 1 }),
          });
        }
      }

      setExpandId(null);
      toast("success", "Data HTM berhasil disimpan");
    } catch {
      toast("error", "Gagal menyimpan data HTM");
    } finally {
      setSavingScheduleId(null);
    }
  }

  function openExpand(scheduleId: string) {
    const s = htmSchedules.find((x) => x.id === scheduleId);
    if (!s) return;
    setPaidState((prev) => ({ ...prev, [scheduleId]: getPaidMembers(s) }));
    setMemberSearch("");
    setExpandId(scheduleId);
  }

  const filtered = htmSchedules.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.sparingOpponent || "").toLowerCase().includes(q);
  });

  const totalPaid = useMemo(() => {
    let count = 0;
    for (const s of htmSchedules) count += getPaidMembers(s).length;
    return count;
  }, [htmSchedules]);

  if (!schedulesLoaded || !attendancesLoaded || !membersLoaded || !mutasisLoaded || !matchesLoaded) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bayar HTM</h1>
          <p className="mt-0.5 text-sm text-gray-500">{htmSchedules.length} jadwal dengan HTM &middot; {totalPaid} pemain sudah bayar</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari jadwal..." className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pl-10 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
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
            const pesertaPaid = paid.filter((id) => peserta.some((p) => p.id === id));
            const isLocked = getHtmLocked(s);

            const allPlayerCocks = peserta.map((m) => getPlayerCockCost(s.id, m.id));
            const scheduleTotalCocks = allPlayerCocks.reduce((s, c) => s + c.totalCocks, 0);
            const scheduleTotalCockCost = allPlayerCocks.reduce((s, c) => s + c.cost, 0);

            return (
              <div key={s.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
                      <DollarSign className="h-5 w-5 text-[var(--color-primary)]" />
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
                      <p className="text-sm font-bold text-[var(--color-primary)]">{s.htmInsidentil ? `Member Rp${(s.htm||0).toLocaleString("id-ID")} / Insidentil Rp${s.htmInsidentil.toLocaleString("id-ID")}` : `Rp ${(s.htm||0).toLocaleString("id-ID")}/org`}</p>
                      <p className="text-xs text-gray-400">{peserta.length} pemain &middot; {paidIds.length} bayar</p>
                    </div>
                    {isOpen ? (
                      <button onClick={() => setExpandId(null)} className="rounded-xl border border-gray-200 p-2.5 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                    ) : (
                      <>
                        <button onClick={async () => { await updateSchedule(s.id, { notes: toggleHtmLocked(s) }); }} className="rounded-xl border border-gray-200 p-2.5 text-gray-400 hover:bg-gray-50" title={isLocked ? "Kunci dibuka" : "Kunci jadwal"}>
                          <Lock className={`h-4 w-4 ${isLocked ? "text-red-400" : "text-gray-300"}`} />
                        </button>
                        <button onClick={() => openExpand(s.id)} className="rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"><Pencil className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-5 pt-4 sm:px-5">
                    <div className="mb-3 flex items-center gap-4 text-sm">
                      {scheduleTotalCocks > 0 && (
                        <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-700">Total {scheduleTotalCocks} cock: Rp{scheduleTotalCockCost.toLocaleString("id-ID")}</span>
                      )}
                      <span className="text-xs text-gray-400">HTM {s.htmInsidentil ? `Member ${(s.htm||0).toLocaleString("id-ID")} / Insidentil ${s.htmInsidentil.toLocaleString("id-ID")}` : `Rp ${(s.htm||0).toLocaleString("id-ID")}`}/org</span>
                    </div>
                    <div className="mb-3 flex items-center gap-2">
                      <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Cari pemain..." className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">Daftar Pemain</h4>
                      {!isLocked && (
                        <button onClick={() => checkAllUnpaid(s.id)} className="text-xs font-medium text-[var(--color-primary)] hover:underline">Centang Semua</button>
                      )}
                    </div>
                    {peserta.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">Belum ada peserta terdaftar</p>
                    ) : (
                      <div className="space-y-1">
                        {peserta.filter((m) => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase())).map((m) => isLocked ? (
                          <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${paid.includes(m.id) ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-gray-300"}`}>
                              {paid.includes(m.id) && <Check className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <span className="flex-1 text-sm font-medium text-gray-900">{m.name}</span>
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-600">{m.class}</span>
                            {m.memberType === "insidentil" && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">Insidentil</span>}
                            <span className="text-xs text-gray-400">{getHtmRate(s, m).toLocaleString("id-ID")}{(getPlayerCockCost(s.id, m.id).cost > 0 ? ` + ${getPlayerCockCost(s.id, m.id).totalCocks}cock` : "")}</span>
                            {paid.includes(m.id) && <span className="text-xs font-semibold text-[var(--color-primary)]">Lunas</span>}
                          </div>
                        ) : (
                          <label key={m.id} onClick={() => togglePaid(s.id, m.id)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${paid.includes(m.id) ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-gray-300"}`}>
                              {paid.includes(m.id) && <Check className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <span className="flex-1 text-sm font-medium text-gray-900">{m.name}</span>
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-600">{m.class}</span>
                            {m.memberType === "insidentil" && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">Insidentil</span>}
                            <span className="text-xs text-gray-400">{getHtmRate(s, m).toLocaleString("id-ID")}{(getPlayerCockCost(s.id, m.id).cost > 0 ? ` + ${getPlayerCockCost(s.id, m.id).totalCocks}cock` : "")}</span>
                            <span className="text-xs font-semibold text-[var(--color-primary)]">Rp{(getHtmRate(s, m) + getPlayerCockCost(s.id, m.id).cost).toLocaleString("id-ID")}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {!isLocked && (
                      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                        <p className="text-sm text-gray-500">{pesertaPaid.length} / {peserta.length} sudah bayar</p>
                        <div className="flex gap-2">
                          <button onClick={() => setExpandId(null)} disabled={savingScheduleId === s.id} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Batal</button>
                          <button onClick={() => savePaid(s.id)} disabled={savingScheduleId === s.id} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{savingScheduleId === s.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="h-3.5 w-3.5" /> Simpan</>}</button>
                        </div>
                      </div>
                    )}
                    {isLocked && (
                      <button onClick={() => setExpandId(null)} className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Tutup</button>
                    )}
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
