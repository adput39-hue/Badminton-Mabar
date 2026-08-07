"use client";

import { useState, useEffect, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiLabaRugi, ApiSchedule, ApiKasBiaya } from "@/lib/api-types";
import { TrendingUp, ChevronDown, ChevronUp, Calculator, Save, Search, DollarSign, Target, Receipt } from "lucide-react";
import { useToast } from "@/components/toast";
import { getClientPbId } from "@/lib/tenant";

const monthNames = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OKT", "NOP", "DES"];
const dayNames = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dayNames[dt.getDay()]}, ${dt.getDate()} ${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
}

function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

export default function LabaRugiPage() {
  const { items: labaRugis, refresh: refreshLr } = useApi<ApiLabaRugi>("laba-rugi");
  const { items: schedules } = useApi<ApiSchedule>("schedules");
  const { items: biayas } = useApi<ApiKasBiaya>("kas-biaya");
  const [search, setSearch] = useState("");
  const [expandId, setExpandId] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Record<string, { cockCost: number; courtCost: number; cockBiayaId: string | null; courtBiayaId: string | null }>>({});
  const { toast } = useToast();
  const pbId = getClientPbId();

  const activeBiayas = useMemo(() => biayas.filter((b) => b.isActive), [biayas]);

  const completedSchedules = useMemo(() => {
    return schedules
      .filter((s) => s.status === "completed" || s.status === "ongoing")
      .filter((s) => ((s.htm && s.htm > 0) || (s.htmInsidentil && s.htmInsidentil > 0)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [schedules]);

  const merged = useMemo(() => {
    const lrMap = new Map(labaRugis.map((l) => [l.scheduleId, l]));
    return completedSchedules.map((s) => ({
      schedule: s,
      labaRugi: lrMap.get(s.id) || null,
    }));
  }, [completedSchedules, labaRugis]);

  const filtered = useMemo(() => {
    if (!search) return merged;
    const q = search.toLowerCase();
    return merged.filter((m) => m.schedule.title.toLowerCase().includes(q) || (m.schedule.sparingOpponent || "").toLowerCase().includes(q));
  }, [merged, search]);

  function getPaidCount(schedule: ApiSchedule): number {
    if (!schedule.notes) return 0;
    try {
      const parsed = JSON.parse(schedule.notes);
      if (Array.isArray(parsed.paidMembers)) return parsed.paidMembers.length;
    } catch {}
    return 0;
  }

  function calcIncome(schedule: ApiSchedule) {
    return (schedule.htm || 0) * getPaidCount(schedule);
  }

  async function calculateAll() {
    setCalculating(true);
    try {
      for (const s of completedSchedules) {
        const existing = labaRugis.find((l) => l.scheduleId === s.id);
        if (!existing) {
          await fetch("/api/laba-rugi", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-pb-id": pbId || "" },
            body: JSON.stringify({ scheduleId: s.id }),
          });
        }
      }
      await refreshLr();
      toast("success", "Semua jadwal berhasil dihitung");
    } catch (err) {
      toast("error", "Gagal menghitung: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setCalculating(false);
  }

  async function calculateSingle(scheduleId: string) {
    try {
      const res = await fetch("/api/laba-rugi", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pb-id": pbId || "" },
        body: JSON.stringify({ scheduleId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshLr();
      toast("success", "Berhasil dihitung");
    } catch (err) {
      toast("error", "Gagal: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  function openEdit(lr: ApiLabaRugi) {
    setExpandId(lr.id);
    setEditMap((prev) => ({
      ...prev,
      [lr.id]: { cockCost: lr.cockCost, courtCost: lr.courtCost, cockBiayaId: lr.cockBiayaId, courtBiayaId: lr.courtBiayaId },
    }));
  }

  async function saveEdit(lr: ApiLabaRugi) {
    setSavingId(lr.id);
    const e = editMap[lr.id];
    if (!e) return;
    const totalIncome = lr.totalIncome;
    const profitLoss = totalIncome - e.cockCost - e.courtCost;
    try {
      const res = await fetch("/api/laba-rugi/" + lr.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-pb-id": pbId || "" },
        body: JSON.stringify({ ...e, totalIncome, profitLoss }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshLr();
      toast("success", "Disimpan");
    } catch (err) {
      toast("error", "Gagal: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setSavingId(null);
    setExpandId(null);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="h-6 w-6 text-[var(--color-primary)]" /> Laba Rugi</h1>
          <p className="mt-0.5 text-sm text-gray-500">Hitung laba rugi setiap jadwal mabar & sparing</p>
        </div>
        <button onClick={calculateAll} disabled={calculating}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
          <Calculator className="h-4 w-4" /> {calculating ? "Menghitung..." : "Hitung Semua"}
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari jadwal..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
      </div>

      <div className="space-y-3">
        {filtered.map((m) => {
          const lr = m.labaRugi;
          const income = lr ? (lr.totalIncome ?? calcIncome(m.schedule)) : calcIncome(m.schedule);
          const isExpanded = lr && expandId === lr.id;
          const edit = lr ? editMap[lr.id] : null;
          const cockCost = edit?.cockCost ?? lr?.cockCost ?? 0;
          const courtCost = edit?.courtCost ?? lr?.courtCost ?? 0;
          const pl = income - cockCost - courtCost;

          return (
            <div key={m.schedule.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 p-4 sm:p-5">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                  <span className="text-lg font-bold">{new Date(m.schedule.date).getDate()}</span>
                  <span className="text-[9px] font-medium uppercase leading-tight">{monthNames[new Date(m.schedule.date).getMonth()].slice(0, 3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{m.schedule.title}</h3>
                    {m.schedule.sparingOpponent && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 shrink-0">Sparing</span>}
                  </div>
                  <p className="text-xs text-gray-500">{fmtDate(m.schedule.date)} &middot; {getPaidCount(m.schedule)}/{m.schedule.maxParticipants} bayar</p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatRupiah(income)}</p>
                  <p className="text-[10px] text-gray-400">Pendapatan</p>
                </div>
                {lr ? (
                  <div className="text-right">
                    <p className={`text-sm font-bold ${pl >= 0 ? "text-green-600" : "text-red-600"}`}>{formatRupiah(pl)}</p>
                    <p className="text-[10px] text-gray-400">Laba/Rugi</p>
                  </div>
                ) : (
                  <button onClick={() => calculateSingle(m.schedule.id)}
                    className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]">Hitung</button>
                )}
                {lr && (
                  <button onClick={() => isExpanded ? setExpandId(null) : openEdit(lr)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {isExpanded && lr && edit && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1"><DollarSign className="h-3 w-3 inline" /> Pendapatan</label>
                      <p className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-700">{formatRupiah(income)}</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">Auto: total kas &quot;Bayar HTM&quot; ({getPaidCount(m.schedule)} pemain)</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1"><Target className="h-3 w-3 inline" /> Cock (Shuttlecock)</label>
                      <select value={edit.cockBiayaId || ""} onChange={(e) => {
                        const biaya = activeBiayas.find((b) => b.id === e.target.value);
                        setEditMap((prev) => ({ ...prev, [lr.id]: { ...prev[lr.id], cockBiayaId: e.target.value || null, cockCost: biaya?.amount ?? edit.cockCost } }));
                      }} className="mb-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                        <option value="" disabled>Pilih biaya cock</option>
                        {activeBiayas.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.amount ? formatRupiah(b.amount) : "—"})</option>)}
                      </select>
                      <input type="text" value={edit.cockCost ? String(edit.cockCost).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ""} onChange={(e) => setEditMap((prev) => ({ ...prev, [lr.id]: { ...prev[lr.id], cockCost: parseInt(e.target.value.replace(/\D/g, '')) || 0 } }))}
                        placeholder="0" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1"><Receipt className="h-3 w-3 inline" /> Sewa Lapangan</label>
                      <select value={edit.courtBiayaId || ""} onChange={(e) => {
                        const biaya = activeBiayas.find((b) => b.id === e.target.value);
                        setEditMap((prev) => ({ ...prev, [lr.id]: { ...prev[lr.id], courtBiayaId: e.target.value || null, courtCost: biaya?.amount ?? edit.courtCost } }));
                      }} className="mb-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                        <option value="" disabled>Pilih biaya lapangan</option>
                        {activeBiayas.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.amount ? formatRupiah(b.amount) : "—"})</option>)}
                      </select>
                      <input type="text" value={edit.courtCost ? String(edit.courtCost).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ""} onChange={(e) => setEditMap((prev) => ({ ...prev, [lr.id]: { ...prev[lr.id], courtCost: parseInt(e.target.value.replace(/\D/g, '')) || 0 } }))}
                        placeholder="0" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1"><TrendingUp className="h-3 w-3 inline" /> Laba / Rugi</label>
                      <p className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${pl >= 0 ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                        {pl >= 0 ? "+" : ""}{formatRupiah(pl)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => { setExpandId(null) }} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Batal</button>
                    <button onClick={() => saveEdit(lr)} disabled={savingId === lr.id || !edit.cockBiayaId || !edit.courtBiayaId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
                      <Save className="h-3.5 w-3.5" /> {savingId === lr.id ? "Menyimpan..." : "Simpan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <TrendingUp className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Belum ada jadwal selesai dengan HTM</p>
          </div>
        )}
      </div>
    </div>
  );
}
