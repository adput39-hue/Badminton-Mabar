"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function getMonthKey(d: string) {
  const dt = new Date(d);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
}

function getMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return monthNames[parseInt(m) - 1] + " " + y;
}

function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function getName(id: string, members: ApiMember[]) {
  return members.find((m) => m.id === id)?.name || "—";
}

export default function LaporanCockPage() {
  const { items: matches, loaded: matchesLoaded } = useApi<ApiMatch>("matches");
  const { items: schedules, loaded: schedulesLoaded } = useApi<ApiSchedule>("schedules");
  const { items: members, loaded: membersLoaded } = useApi<ApiMember>("members");

  const [expandSchedule, setExpandSchedule] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState("all");

  const cockMatches = useMemo(() => {
    return matches.filter((m) => m.status === "completed" && m.cockCount && m.cockCount > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [matches]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, ApiSchedule>();
    schedules.forEach((s) => map.set(s.id, s));
    return map;
  }, [schedules]);

  const grouped = useMemo(() => {
    const map = new Map<string, { schedule: ApiSchedule; matches: ApiMatch[]; totalCock: number; totalCost: number }>();
    cockMatches.forEach((m) => {
      const s = scheduleMap.get(m.scheduleId);
      if (!s) return;
      if (monthFilter !== "all" && getMonthKey(s.date) !== monthFilter) return;
      const existing = map.get(m.scheduleId) || { schedule: s, matches: [], totalCock: 0, totalCost: 0 };
      existing.matches.push(m);
      existing.totalCock += m.cockCount || 0;
      existing.totalCost += (m.cockCount || 0) * (s.cockPrice || 0);
      map.set(m.scheduleId, existing);
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.schedule.date).getTime() - new Date(a.schedule.date).getTime());
  }, [cockMatches, scheduleMap, monthFilter]);

  const monthOpts = useMemo(() => {
    const s = new Set<string>();
    cockMatches.forEach((m) => {
      const sc = scheduleMap.get(m.scheduleId);
      if (sc) s.add(getMonthKey(sc.date));
    });
    return Array.from(s).sort().reverse();
  }, [cockMatches, scheduleMap]);

  const grandTotal = useMemo(() => {
    return grouped.reduce((acc, g) => ({ totalCock: acc.totalCock + g.totalCock, totalCost: acc.totalCost + g.totalCost }), { totalCock: 0, totalCost: 0 });
  }, [grouped]);

  if (!matchesLoaded || !schedulesLoaded || !membersLoaded) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-4xl px-4">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Pemakaian Cock</h1>
          <p className="mt-0.5 text-sm text-gray-500">Rekap pemakaian cock per jadwal</p>
        </div>
        <div className="flex items-center gap-2">
          {monthOpts.length > 0 && (
            <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)]">
              <option value="all">Semua Bulan</option>
              {monthOpts.map((mk) => <option key={mk} value={mk}>{getMonthLabel(mk)}</option>)}
            </select>
          )}
        </div>
      </div>

      {grandTotal.totalCock > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Jadwal</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{grouped.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Cock</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{grandTotal.totalCock} buah</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Biaya Cock</p>
            <p className="mt-1 text-xl font-bold text-orange-600">{formatRupiah(grandTotal.totalCost)}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map((g) => {
          const expanded = expandSchedule === g.schedule.id;
          return (
            <div key={g.schedule.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => setExpandSchedule(expanded ? null : g.schedule.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{g.schedule.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(g.schedule.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{g.totalCock} cock</p>
                    <p className="text-xs text-orange-600">{formatRupiah(g.totalCost)}</p>
                  </div>
                  {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>
              {expanded && (
                <div className="border-t border-gray-100 px-5 py-3 space-y-2">
                  {g.matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
                      <div className="text-sm text-gray-800">
                        <span className="font-medium">{getName(m.team1Player1Id, members)}</span>
                        {m.team1Player2Id && <span> + {getName(m.team1Player2Id, members)}</span>}
                        <span className="mx-1.5 text-gray-400">vs</span>
                        <span className="font-medium">{getName(m.team2Player1Id, members)}</span>
                        {m.team2Player2Id && <span> + {getName(m.team2Player2Id, members)}</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{m.cockCount} cock</p>
                        <p className="text-xs text-gray-500">{m.scoreTeam1}-{m.scoreTeam2}{m.totalGames === 2 && m.scoreTeam1Game2 !== null ? `, ${m.scoreTeam1Game2}-${m.scoreTeam2Game2}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-sm text-gray-500">Belum ada data pemakaian cock</p>
          </div>
        )}
      </div>
    </div>
  );
}
