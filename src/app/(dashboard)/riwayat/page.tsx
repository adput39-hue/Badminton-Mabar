"use client";

import { useState, useMemo, useEffect } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { Filter, ChevronLeft, ChevronRight, Calendar, Swords, User, ImageIcon } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import ShuttlecockIcon from "@/components/shuttlecock-icon";
import { MatchCardModal } from "@/components/match-card-modal";
import { getNotesText, getGameTarget, getGameWinner } from "@/lib/utils";

const courtColors = [
  { bg: "bg-green-500", light: "bg-green-50", border: "border-green-500" },
  { bg: "bg-blue-500", light: "bg-blue-50", border: "border-blue-500" },
  { bg: "bg-purple-500", light: "bg-purple-50", border: "border-purple-500" },
  { bg: "bg-amber-500", light: "bg-amber-50", border: "border-amber-500" },
  { bg: "bg-rose-500", light: "bg-rose-50", border: "border-rose-500" },
];

export default function RiwayatPage() {
  const { items: matches, loaded: matchesLoaded } = useApi<ApiMatch>("matches");
  const { items: schedules, loaded: schedulesLoaded } = useApi<ApiSchedule>("schedules");
  const { items: members, loaded: membersLoaded } = useApi<ApiMember>("members");
  const [pbName, setPbName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.pb?.name) setPbName(u.pb.name);
      }
    } catch {}
  }, []);

  const [filterSchedule, setFilterSchedule] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [cardMatch, setCardMatch] = useState<ApiMatch | null>(null);

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
    <div className="mx-auto max-w-[1440px] px-2 py-4 sm:px-4 sm:py-6 md:px-6" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Header */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] px-4 py-4 shadow-md sm:px-6 sm:py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-white sm:text-xl">Riwayat Pertandingan</h1>
            <p className="text-xs text-white/70 sm:text-sm">{completed.length} pertandingan selesai</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scheduleOpts.length > 1 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                <Filter className="h-3.5 w-3.5 text-white/60" />
                <select value={filterSchedule} onChange={(e) => { setFilterSchedule(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-medium text-white outline-none [&>option]:text-gray-900">
                  <option value="">Semua Jadwal</option>
                  {scheduleOpts.map((s) => <option key={s.id} value={s.id}>{s.title} ({formatDate(s.date)})</option>)}
                </select>
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 backdrop-blur-sm">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="flex items-center justify-center rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[3rem] text-center text-xs font-semibold text-white">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="flex items-center justify-center rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!matchesLoaded || !schedulesLoaded || !membersLoaded ? (
        <LoadingSpinner />
      ) : paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-gray-300 shadow-sm">
          <Swords className="mb-3 h-12 w-12" />
          <p className="text-sm font-medium text-gray-400">Belum ada pertandingan selesai</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paged.map((m) => {
            const s = getSchedule(m.scheduleId);
            const courtIdx = (m.courtNumber || 1) - 1;
            const color = courtColors[courtIdx % courtColors.length];
            const t1s = m.scoreTeam1 || 0;
            const t2s = m.scoreTeam2 || 0;
            const t1g2 = m.scoreTeam1Game2 ?? 0;
            const t2g2 = m.scoreTeam2Game2 ?? 0;
            const t1g3 = m.scoreTeam1Game3 ?? 0;
            const t2g3 = m.scoreTeam2Game3 ?? 0;
            const isTwoGame = getNotesText(m.notes).startsWith("2-21");
            const hasG2 = isTwoGame && (m.scoreTeam1Game2 != null || m.scoreTeam2Game2 != null);
            const hasG3 = isTwoGame && (m.scoreTeam1Game3 != null || m.scoreTeam2Game3 != null);
            const gameCols = 1 + (hasG2 ? 1 : 0) + (hasG3 ? 1 : 0);
            const target = getGameTarget(getNotesText(m.notes));
            const g1w = getGameWinner(t1s, t2s, target);
            const g2w = hasG2 ? getGameWinner(t1g2, t2g2, target) : null;
            const g3w = hasG3 ? getGameWinner(t1g3, t2g3, target) : null;

            return (
              <div key={m.id} className="relative rounded-xl border border-gray-200 bg-white p-3 shadow-sm ring-1 ring-gray-50 transition-all hover:shadow-md sm:p-3">
                {/* Court label + date */}
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700 sm:text-xs">
                    <span className={`flex items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-black text-white sm:text-[10px] ${color.bg}`}>{m.courtNumber || "-"}</span>
                    {m.winnerTeam === 1 || m.winnerTeam === 2 ? (
                      <span className="text-green-600">✓</span>
                    ) : m.status === "completed" ? (
                      <span className="text-amber-500">SERI</span>
                    ) : (
                      <span className="text-gray-400">⏳</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-gray-400 sm:text-[11px]">
                    <Calendar className="h-3 w-3" />
                    {s ? formatDate(s.date) : ""}
                  </span>
                </div>

                {/* Score chart */}
                <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(${gameCols}, min-content)`, gap: "0.25rem 0.25rem", alignItems: "center" }}>
                  <div className="text-[9px] font-semibold tracking-wider whitespace-nowrap text-gray-400 uppercase sm:text-[10px]">PASANGAN</div>
                  <div className="text-center text-[9px] font-semibold tracking-wider whitespace-nowrap text-gray-400 uppercase sm:text-[10px]">G1</div>
                  {hasG2 && <div className="text-center text-[9px] font-semibold tracking-wider whitespace-nowrap text-gray-400 uppercase sm:text-[10px]">G2</div>}
                  {hasG3 && <div className="text-center text-[9px] font-semibold tracking-wider whitespace-nowrap text-gray-400 uppercase sm:text-[10px]">G3</div>}
                  <hr className="border-gray-200" style={{ gridColumn: `1 / span ${gameCols + 1}` }} />
                  {/* Team 1 */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <ShuttlecockIcon size={14} className="shrink-0 text-green-500" />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[10px] sm:text-[11px] ${m.winnerTeam === 1 ? "font-bold text-gray-900" : m.winnerTeam === 2 ? "text-gray-400" : "text-gray-700"}`}>{getName(m.team1Player1Id)}</p>
                      <p className={`truncate text-[10px] sm:text-[11px] ${m.winnerTeam === 1 ? "font-bold text-gray-900" : m.winnerTeam === 2 ? "text-gray-400" : "text-gray-700"}`}>{getName(m.team1Player2Id)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${g1w === 1 ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>{t1s}</span>
                  </div>
                  {hasG2 && (
                    <div className="flex items-center justify-center">
                      <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${g2w === 1 ? "border-green-200 bg-green-50/50 text-green-600" : "border-gray-200 bg-gray-50 text-gray-400"}`}>{t1g2}</span>
                    </div>
                  )}
                  {hasG3 && (
                    <div className="flex items-center justify-center">
                      <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${g3w === 1 ? "border-green-200 bg-green-50/50 text-green-600" : "border-gray-200 bg-gray-50 text-gray-400"}`}>{t1g3}</span>
                    </div>
                  )}
                  <hr className="border-gray-200" style={{ gridColumn: `1 / span ${gameCols + 1}` }} />
                  {/* Team 2 */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <User size={14} className="shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[10px] sm:text-[11px] ${m.winnerTeam === 2 ? "font-bold text-gray-900" : m.winnerTeam === 1 ? "text-gray-400" : "text-gray-700"}`}>{getName(m.team2Player1Id)}</p>
                      <p className={`truncate text-[10px] sm:text-[11px] ${m.winnerTeam === 2 ? "font-bold text-gray-900" : m.winnerTeam === 1 ? "text-gray-400" : "text-gray-700"}`}>{getName(m.team2Player2Id)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${g1w === 2 ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>{t2s}</span>
                  </div>
                  {hasG2 && (
                    <div className="flex items-center justify-center">
                      <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${g2w === 2 ? "border-green-200 bg-green-50/50 text-green-600" : "border-gray-200 bg-gray-50 text-gray-400"}`}>{t2g2}</span>
                    </div>
                  )}
                  {hasG3 && (
                    <div className="flex items-center justify-center">
                      <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${g3w === 2 ? "border-green-200 bg-green-50/50 text-green-600" : "border-gray-200 bg-gray-50 text-gray-400"}`}>{t2g3}</span>
                    </div>
                  )}
                </div>

                {/* Round & mode */}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-center text-[9px] text-gray-400 sm:text-[10px]">
                    R{m.round} · {s?.sparingOpponent ? `${pbName || "PB"} vs ${s.sparingOpponent}` : s?.title || ""}
                  </p>
                  <button onClick={() => setCardMatch(m)} title="Buat Match Card"
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] sm:text-[10px]">
                    <ImageIcon className="h-3 w-3" /> Card
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cardMatch && (
        <MatchCardModal
          match={cardMatch}
          members={members}
          title={(() => {
            const s = getSchedule(cardMatch.scheduleId);
            return s?.sparingOpponent ? `${pbName || "PB"} vs ${s.sparingOpponent}` : s?.title || "Pertandingan";
          })()}
          onClose={() => setCardMatch(null)} />
      )}
    </div>
  );
}
