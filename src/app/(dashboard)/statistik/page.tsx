"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMember, ApiAttendance, ApiMatchHistory, ApiMatch, ApiSchedule, ApiLabaRugi } from "@/lib/api-types";
import { BarChart3, Users, Trophy, Target, Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tabs = [
  { key: "members", label: "Anggota Teraktif", icon: Users },
  { key: "trend", label: "Trend Kehadiran", icon: TrendingUp },
  { key: "performa", label: "Performa Match", icon: Trophy },
  { key: "keuangan", label: "Rekap Keuangan", icon: DollarSign },
  { key: "aktivitas", label: "Aktivitas Bulanan", icon: Calendar },
];

function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function classNames(...c: (string | boolean | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function Bar({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-gray-600 truncate text-right shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded-lg bg-gray-100 overflow-hidden">
        <div className="h-full rounded-lg transition-all" style={{ width: pct + "%", backgroundColor: color || "var(--color-primary)" }} />
      </div>
      <span className="w-16 text-xs font-semibold text-gray-700 shrink-0">{value}</span>
    </div>
  );
}

export default function StatistikPage() {
  const [tab, setTab] = useState("members");
  const { items: members } = useApi<ApiMember>("members");
  const { items: attendances } = useApi<ApiAttendance>("attendances");
  const { items: matchHistories } = useApi<ApiMatchHistory>("match-history");
  const { items: matches } = useApi<ApiMatch>("matches");
  const { items: schedules } = useApi<ApiSchedule>("schedules");
  const { items: labaRugis } = useApi<ApiLabaRugi>("laba-rugi");

  const activeMembers = useMemo(() => members.filter((m) => m.isActive), [members]);

  const memberAttendance = useMemo(() => {
    const counts: Record<string, number> = {};
    attendances.filter((a) => a.status === "hadir").forEach((a) => { counts[a.memberId] = (counts[a.memberId] || 0) + 1; });
    return Object.entries(counts)
      .map(([memberId, count]) => ({ memberId, count, member: activeMembers.find((m) => m.id === memberId) }))
      .filter((x) => x.member)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [attendances, activeMembers]);
  const maxAttendance = memberAttendance[0]?.count || 1;

  const trendData = useMemo(() => {
    const schedMap = new Map(schedules.map((s) => [s.id, s]));
    const counted: Record<string, { date: string; title: string; count: number }> = {};
    attendances.filter((a) => a.status === "hadir").forEach((a) => {
      const s = schedMap.get(a.scheduleId);
      if (!s) return;
      if (!counted[a.scheduleId]) counted[a.scheduleId] = { date: s.date, title: s.title, count: 0 };
      counted[a.scheduleId].count++;
    });
    return Object.values(counted).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [attendances, schedules]);
  const maxTrend = Math.max(...trendData.map((t) => t.count), 1);

  const performaData = useMemo(() => {
    const stats: Record<string, { wins: number; losses: number }> = {};
    matchHistories.forEach((mh) => {
      if (!stats[mh.memberId]) stats[mh.memberId] = { wins: 0, losses: 0 };
      if (mh.result === "win") stats[mh.memberId].wins++;
      else stats[mh.memberId].losses++;
    });
    return Object.entries(stats)
      .map(([memberId, s]) => ({ memberId, ...s, total: s.wins + s.losses, member: activeMembers.find((m) => m.id === memberId) }))
      .filter((x) => x.member && x.total >= 3)
      .sort((a, b) => b.wins / b.total - a.wins / a.total)
      .slice(0, 20);
  }, [matchHistories, activeMembers]);

  const keuanganData = useMemo(() => {
    const monthly: Record<string, { income: number; cock: number; court: number; count: number }> = {};
    labaRugis.forEach((lr) => {
      if (!lr.schedule) return;
      const d = new Date(lr.schedule.date);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!monthly[key]) monthly[key] = { income: 0, cock: 0, court: 0, count: 0 };
      monthly[key].income += lr.totalIncome;
      monthly[key].cock += lr.cockCost;
      monthly[key].court += lr.courtCost;
      monthly[key].count++;
    });
    return Object.entries(monthly).map(([key, d]) => ({ key, ...d })).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  }, [labaRugis]);
  const maxKeuangan = Math.max(...keuanganData.map((k) => k.income), 1);

  const aktivitasData = useMemo(() => {
    const monthly: Record<string, { schedules: number; matches: number }> = {};
    schedules.filter((s) => s.status === "completed").forEach((s) => {
      const d = new Date(s.date);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!monthly[key]) monthly[key] = { schedules: 0, matches: 0 };
      monthly[key].schedules++;
    });
    matches.forEach((m) => {
      const s = schedules.find((s) => s.id === m.scheduleId);
      if (!s) return;
      const d = new Date(s.date);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!monthly[key]) monthly[key] = { schedules: 0, matches: 0 };
      monthly[key].matches++;
    });
    return Object.entries(monthly).map(([key, d]) => ({ key, ...d })).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  }, [schedules, matches]);
  const maxAktivitas = Math.max(...aktivitasData.map((a) => Math.max(a.schedules, a.matches)), 1);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="h-6 w-6 text-[var(--color-primary)]" /> Statistik</h1>
        <p className="mt-0.5 text-sm text-gray-500">Analitik dan rekap data PB</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={classNames(
                "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                tab === t.key ? "bg-[var(--color-primary)] text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              )}><Icon className="h-4 w-4" /> {t.label}</button>
          );
        })}
      </div>

      {tab === "members" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-[var(--color-primary)]" /> Anggota Teraktif (Top 20)</h2>
          <div className="space-y-2.5">
            {memberAttendance.map((x, i) => (
              <div key={x.memberId} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-gray-400 shrink-0">{i + 1}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">
                  {x.member!.name.charAt(0)}
                </div>
                <span className="flex-1 text-sm text-gray-700 truncate">{x.member!.name}</span>
                <div className="flex-1 h-4 rounded-lg bg-gray-100 overflow-hidden max-w-[200px]">
                  <div className="h-full rounded-lg bg-[var(--color-primary)] transition-all" style={{ width: (x.count / maxAttendance) * 100 + "%" }} />
                </div>
                <span className="w-12 text-xs font-semibold text-gray-700 text-right">{x.count}x</span>
              </div>
            ))}
            {memberAttendance.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Belum ada data kehadiran</p>}
          </div>
        </div>
      )}

      {tab === "trend" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[var(--color-primary)]" /> Trend Kehadiran (30 jadwal terakhir)</h2>
          <div className="space-y-2.5">
            {trendData.map((t) => {
              const d = new Date(t.date);
              return <Bar key={t.date + t.title} label={d.getDate() + " " + monthNames[d.getMonth()]} value={t.count} max={maxTrend} />;
            })}
            {trendData.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Belum ada data kehadiran</p>}
          </div>
        </div>
      )}

      {tab === "performa" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-[var(--color-primary)]" /> Performa Match (min 3 pertandingan)</h2>
          <div className="space-y-3">
            {performaData.map((p, i) => (
              <div key={p.memberId} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-gray-400 shrink-0">{i + 1}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">
                  {p.member!.name.charAt(0)}
                </div>
                <span className="flex-1 text-sm text-gray-700 truncate">{p.member!.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-green-600">{p.wins}W</span>
                  <span className="text-xs text-gray-300">/</span>
                  <span className="text-xs font-bold text-red-600">{p.losses}L</span>
                </div>
                <div className="w-24 h-4 rounded-lg bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-lg bg-green-500" style={{ width: ((p.wins / p.total) * 100) + "%" }} />
                </div>
                <span className="w-12 text-xs font-bold text-right" style={{ color: p.wins / p.total >= 0.5 ? "var(--color-primary)" : "#dc2626" }}>
                  {Math.round((p.wins / p.total) * 100)}%
                </span>
              </div>
            ))}
            {performaData.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Belum cukup data pertandingan</p>}
          </div>
        </div>
      )}

      {tab === "keuangan" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4 text-[var(--color-primary)]" /> Rekap Keuangan (12 bulan terakhir)</h2>
          <div className="space-y-3">
            {keuanganData.map((k) => {
              const [y, m] = k.key.split("-");
              return (
                <div key={k.key}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{monthNames[parseInt(m) - 1]} {y}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-[10px] text-green-600 font-medium shrink-0">Masuk</span>
                      <div className="flex-1 h-4 rounded-lg bg-green-100 overflow-hidden">
                        <div className="h-full rounded-lg bg-green-500 transition-all" style={{ width: (k.income / maxKeuangan) * 100 + "%" }} />
                      </div>
                      <span className="w-20 text-[10px] font-semibold text-green-700 text-right shrink-0">{formatRupiah(k.income)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-[10px] text-orange-600 font-medium shrink-0">Keluar</span>
                      <div className="flex-1 h-4 rounded-lg bg-orange-100 overflow-hidden">
                        <div className="h-full rounded-lg bg-orange-400 transition-all" style={{ width: ((k.cock + k.court) / maxKeuangan) * 100 + "%" }} />
                      </div>
                      <span className="w-20 text-[10px] font-semibold text-orange-700 text-right shrink-0">{formatRupiah(k.cock + k.court)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {keuanganData.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Belum ada data laba rugi</p>}
          </div>
        </div>
      )}

      {tab === "aktivitas" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-[var(--color-primary)]" /> Aktivitas Bulanan (12 bulan terakhir)</h2>
          <div className="space-y-3">
            {aktivitasData.map((a) => {
              const [y, m] = a.key.split("-");
              return (
                <div key={a.key}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{monthNames[parseInt(m) - 1]} {y}</p>
                  <div className="space-y-1.5">
                    <Bar label="Jadwal" value={a.schedules} max={maxAktivitas} color="var(--color-primary)" />
                    <Bar label="Match" value={a.matches} max={maxAktivitas} color="#8b5cf6" />
                  </div>
                </div>
              );
            })}
            {aktivitasData.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Belum ada data aktivitas</p>}
          </div>
        </div>
      )}
    </div>
  );
}
