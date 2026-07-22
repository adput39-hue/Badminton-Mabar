"use client";

import { useState, useMemo, useEffect } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { Filter, ChevronLeft, ChevronRight } from "lucide-react";

export default function RiwayatPage() {
  const { items: matches, refresh: refreshMatches } = useApi<ApiMatch>("matches");
  const { items: schedules } = useApi<ApiSchedule>("schedules");
  const { items: members } = useApi<ApiMember>("members");

  const [filterSchedule, setFilterSchedule] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 12;

  useEffect(() => {
    const id = setInterval(() => refreshMatches(), 5000);
    return () => clearInterval(id);
  }, [refreshMatches]);

  const completed = useMemo(() =>
    matches.filter((m) => m.status === "completed")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  [matches]);

  const filtered = filterSchedule ? completed.filter((m) => m.scheduleId === filterSchedule) : completed;
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }
  function getSchedule(id: string) { return schedules.find((s) => s.id === id); }
  function formatDate(d: string) { return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" }); }

  const scheduleOpts = useMemo(() => {
    const ids = new Set(completed.map((m) => m.scheduleId));
    return schedules.filter((s) => ids.has(s.id)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [schedules, completed]);

  return (
    <div className="mx-auto px-4" style={{ backgroundColor: "#F8FAFC", maxWidth: 1400 }}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>Riwayat Pertandingan</h1>
          <p className="mt-1 text-sm font-medium" style={{ color: "#64748B" }}>{completed.length} pertandingan selesai</p>
        </div>
        <div className="flex items-center gap-3">
          {scheduleOpts.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" style={{ color: "#64748B" }} />
              <select value={filterSchedule} onChange={(e) => { setFilterSchedule(e.target.value); setPage(1); }}
                className="rounded-xl border px-4 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-[#0d9488]/10"
                style={{ borderColor: "#E2E8F0", color: "#0F172A" }}>
                <option value="">Semua Jadwal</option>
                {scheduleOpts.map((s) => <option key={s.id} value={s.id}>{s.title} ({formatDate(s.date)})</option>)}
              </select>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-40"
                style={{ borderColor: "#E2E8F0", color: "#0F172A" }}>
                <ChevronLeft className="h-3.5 w-3.5" style={{ color: "#64748B" }} />
              </button>
              <span className="text-xs font-semibold" style={{ color: "#64748B" }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                className="flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-40"
                style={{ borderColor: "#E2E8F0", color: "#0F172A" }}>
                <ChevronRight className="h-3.5 w-3.5" style={{ color: "#64748B" }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {paged.length === 0 ? (
        <div className="rounded-2xl border bg-white px-6 py-20 text-center shadow-sm" style={{ borderColor: "#E2E8F0", borderRadius: 18 }}>
          <p className="mt-3 text-sm font-medium" style={{ color: "#64748B" }}>Belum ada pertandingan selesai</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paged.map((m) => {
            const s = getSchedule(m.scheduleId);
            const scoreText = `${m.scoreTeam1}-${m.scoreTeam2}` + (m.totalGames === 2 && m.scoreTeam1Game2 !== null ? `, ${m.scoreTeam1Game2}-${m.scoreTeam2Game2}` : "");
            return (
              <div key={m.id} className="border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                style={{ borderColor: "#E2E8F0", borderRadius: 18, boxShadow: "0 4px 18px rgba(0,0,0,0.05)" }}>
                {/* Header: date + score */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium truncate" style={{ color: "#64748B" }}>
                    {s ? formatDate(s.date) : ""} · {s?.title || ""}
                  </span>
                  <span className="shrink-0 text-base font-extrabold tracking-tight" style={{ color: "#0D9488" }}>
                    {scoreText}
                  </span>
                </div>

                {/* Teams */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Team 1 */}
                  <div className="rounded-xl border-2 p-2.5 text-center transition-colors"
                    style={{
                      backgroundColor: m.winnerTeam === 1 ? "#CCFBF1" : "#FFFFFF",
                      borderColor: m.winnerTeam === 1 ? "#0D9488" : "#E2E8F0",
                    }}>
                    <p className="text-[13px] font-bold" style={{ color: "#0F172A" }}>{getName(m.team1Player1Id)}</p>
                    <p className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>+</p>
                    <p className="text-[13px] font-bold" style={{ color: "#0F172A" }}>{getName(m.team1Player2Id)}</p>
                    {m.winnerTeam === 1 && (
                      <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: "#0F766E" }}>Tim Menang</span>
                    )}
                  </div>

                  {/* Team 2 */}
                  <div className="rounded-xl border-2 p-2.5 text-center transition-colors"
                    style={{
                      backgroundColor: m.winnerTeam === 2 ? "#CCFBF1" : "#FFFFFF",
                      borderColor: m.winnerTeam === 2 ? "#0D9488" : "#E2E8F0",
                    }}>
                    <p className="text-[13px] font-bold" style={{ color: "#0F172A" }}>{getName(m.team2Player1Id)}</p>
                    <p className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>+</p>
                    <p className="text-[13px] font-bold" style={{ color: "#0F172A" }}>{getName(m.team2Player2Id)}</p>
                    {m.winnerTeam === 2 && (
                      <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: "#0F766E" }}>Tim Menang</span>
                    )}
                  </div>
                </div>

                {/* Footer: court + round */}
                <div className="mt-2 flex items-center gap-3 text-[10px] font-medium" style={{ color: "#64748B" }}>
                  {m.courtNumber && <span>📍 L.{m.courtNumber}</span>}
                  <span>🎯 R{m.round}</span>
                  {m.winnerTeam === 0 && (
                    <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">Draw</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
