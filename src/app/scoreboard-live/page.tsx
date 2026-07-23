"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api-store";
import { supabase } from "@/lib/supabase";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import {
  Swords, ChevronLeft, Clock, Radio, Trophy, Minus, Plus,
} from "lucide-react";
import ShuttlecockIcon from "@/components/shuttlecock-icon";

const courtColors = [
  { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50", border: "border-green-500" },
  { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-500" },
  { bg: "bg-purple-500", text: "text-purple-600", light: "bg-purple-50", border: "border-purple-500" },
  { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-500" },
  { bg: "bg-rose-500", text: "text-rose-600", light: "bg-rose-50", border: "border-rose-500" },
];

export default function ScoreboardLivePage() {
  const { items: schedules } = useApi<ApiSchedule>("schedules");
  const { items: members } = useApi<ApiMember>("members");
  const { items: matches, refresh: refreshMatches } = useApi<ApiMatch>("matches");

  const [selSparingId, setSelSparingId] = useState<string | null>(null);
  const [selRound, setSelRound] = useState(1);
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

  const sparings = useMemo(() =>
    schedules.filter((s) => s.sparingOpponent).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [schedules]);

  const selectedSparing = sparings.find((s) => s.id === selSparingId);

  const savedSettings = useMemo(() => {
    if (!selectedSparing?.notes) return null;
    try { return JSON.parse(selectedSparing.notes); } catch { return null; }
  }, [selectedSparing]);

  const courts: { name: string; startTime: string; endTime: string }[] = savedSettings?.courts || [];
  const totalRounds: number = savedSettings?.totalRounds || 1;

  const sparingMatches = useMemo(() =>
    matches.filter((m) => m.scheduleId === selSparingId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  [matches, selSparingId]);

  const roundMatches = useMemo(() =>
    sparingMatches.filter((m) => m.round === selRound),
  [sparingMatches, selRound]);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  function shortName(name: string) {
    const parts = name.split(" ");
    return parts.length > 1 ? parts[0] + " " + parts[parts.length - 1][0] + "." : name;
  }

  const stats = useMemo(() => {
    const completed = roundMatches.filter((m) => m.status === "completed");
    const total = roundMatches.length;
    const selesai = completed.length;
    const kitaWins = completed.filter((m) => m.winnerTeam === 1).length;
    const lawanWins = completed.filter((m) => m.winnerTeam === 2).length;
    const kitaPoints = roundMatches.reduce((sum, m) => sum + (m.scoreTeam1 || 0) + (m.scoreTeam1Game2 || 0), 0);
    const lawanPoints = roundMatches.reduce((sum, m) => sum + (m.scoreTeam2 || 0) + (m.scoreTeam2Game2 || 0), 0);
    return { total, selesai, kitaWins, lawanWins, kitaPoints, lawanPoints, sisa: total - selesai };
  }, [roundMatches]);

  useEffect(() => {
    if (!selSparingId) return;
    const channel = supabase
      .channel("scoreboard-live-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        refreshMatches();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selSparingId, refreshMatches]);

  const viewRef = useRef({ selSparingId });
  useEffect(() => { viewRef.current = { selSparingId }; });

  useEffect(() => {
    const handlePop = () => {
      const v = viewRef.current;
      if (v.selSparingId) { setSelSparingId(null); }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  if (!selSparingId) {
    return (
      <div className="relative min-h-screen bg-[#f0fdfa]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25">
              <ChevronLeft className="h-4 w-4" /> Kembali
            </Link>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Scoreboard Live</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Pilih sparing untuk live scoreboard</p>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {sparings.map((s, i) => {
              const sColor = courtColors[i % courtColors.length];
              return (
                <button key={s.id} onClick={() => { history.pushState(null, ""); setSelSparingId(s.id); }}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488] sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${sColor.bg}`}>
                      <span className="text-base font-bold text-white sm:text-lg">{s.sparingOpponent?.replace(/^PB\s*/i, "").slice(0, 2).toUpperCase() || "PB"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 sm:text-base">{pbName || "PB"} vs {s.sparingOpponent || "—"}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">{new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 sm:mt-4">
                    <span className="text-xs text-gray-400">{matches.filter((m) => m.scheduleId === s.id).length} pertandingan</span>
                    <ChevronLeft className="h-4 w-4 -rotate-180 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
          {sparings.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <Swords className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Belum ada sparing</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f0fdfa] overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-3 pt-3 sm:pb-4 sm:pt-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto flex max-w-[1440px] items-center justify-between px-3 sm:px-4">
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/25 sm:text-sm">
            <ChevronLeft className="h-3.5 w-3.5" /> Kembali
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wide text-white uppercase backdrop-blur-sm sm:px-4 sm:py-1.5 sm:text-sm">
              {pbName || "PB"} vs {selectedSparing?.sparingOpponent || "—"}
            </span>
            <span className="text-xs text-white/60">{new Date(selectedSparing?.date || "").toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
          </div>
          <div className="w-20" />
        </div>
      </div>

      {/* Mobile stats bar (bottom fixed) */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white shadow-lg lg:hidden">
        <div className="flex items-center justify-around px-3 py-2 text-xs">
          <div className="text-center">
            <p className="font-semibold text-gray-900">{stats.total}</p>
            <p className="text-gray-500">Total</p>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <Trophy className="h-3 w-3" fill="currentColor" />
            <span className="font-semibold">{stats.kitaWins}</span>
          </div>
          <div className="flex items-center gap-1 text-blue-600">
            <Trophy className="h-3 w-3" fill="currentColor" />
            <span className="font-semibold">{stats.lawanWins}</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">{stats.kitaPoints}</p>
            <p className="text-gray-400">Poin</p>
          </div>
          <div className="border-l border-gray-200 pl-2 text-center">
            <p className="font-semibold text-gray-400">{stats.sisa > 0 ? `${stats.sisa} sisa` : "Selesai"}</p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto flex h-[calc(100vh-52px)] max-w-[1440px] flex-col overflow-hidden p-2 sm:h-[calc(100vh-60px)] sm:p-3 md:p-4">
        <div className="flex flex-1 gap-3 overflow-hidden lg:gap-4">
          {/* Main */}
          <div className="flex-1 overflow-y-auto pb-14 lg:pb-0">
            {/* Round selector */}
            {totalRounds > 1 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase sm:text-xs">Round:</span>
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                  <button key={r} onClick={() => setSelRound(r)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all sm:text-sm ${selRound === r ? "bg-[#0d9488] text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                    Round {r}
                  </button>
                ))}
              </div>
            )}

            {/* Live courts section — show all courts */}
            <div className="mb-3 sm:mb-4">
              <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-gray-500 uppercase sm:text-xs">Sedang Berlangsung</h2>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                  {courts.map((court, i) => {
                    const color = courtColors[i % courtColors.length];
                    const liveMatches = sparingMatches.filter((m) => m.courtNumber === i + 1 && m.status !== "completed");
                    const live = liveMatches[0] || null;
                    const hasLive = !!live;
                    return (
                      <div key={i} className={`flex min-h-[180px] min-w-[180px] flex-1 flex-col rounded-xl border-2 bg-white p-3 shadow-md sm:min-h-[200px] sm:min-w-[200px] sm:p-4 ${hasLive ? color.border : "border-gray-200"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-bold text-gray-900 sm:text-lg">{court.name}</h3>
                          {hasLive ? (
                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700 sm:text-base">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                              LIVE
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-500 sm:text-base">—</span>
                          )}
                        </div>
                        {hasLive && live ? (
                          <>
                            <div className="mt-2 flex items-center justify-center gap-2 sm:mt-3 sm:gap-3">
                              <div className="min-w-0 flex-1 text-right">
                                <p className="truncate text-sm font-medium text-gray-900 sm:text-base">{shortName(getName(live.team1Player1Id))}</p>
                                <p className="truncate text-sm font-medium text-gray-900 sm:text-base">{shortName(getName(live.team1Player2Id))}</p>
                              </div>
                              <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 shadow-sm ring-1 ring-gray-100 sm:gap-2 sm:px-3 sm:py-1.5">
                                {(live.notes || "").startsWith("2-21") ? (
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    <span className="text-lg font-black tabular-nums text-gray-900 sm:text-xl">{live.scoreTeam1 || 0}</span>
                                    <span className="text-xs text-gray-300">/</span>
                                    <span className="text-lg font-black tabular-nums text-gray-900 sm:text-xl">{live.scoreTeam1Game2 || 0}</span>
                                  </div>
                                ) : (
                                  <span className="text-lg font-black tabular-nums text-gray-900 sm:text-xl">{live.scoreTeam1 || 0}</span>
                                )}
                                <span className={`mx-1 h-4 w-0.5 sm:mx-1.5 ${color.bg}`} />
                                {(live.notes || "").startsWith("2-21") ? (
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    <span className="text-lg font-black tabular-nums text-gray-900 sm:text-xl">{live.scoreTeam2 || 0}</span>
                                    <span className="text-xs text-gray-300">/</span>
                                    <span className="text-lg font-black tabular-nums text-gray-900 sm:text-xl">{live.scoreTeam2Game2 || 0}</span>
                                  </div>
                                ) : (
                                  <span className="text-lg font-black tabular-nums text-gray-900 sm:text-xl">{live.scoreTeam2 || 0}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-medium text-gray-900 sm:text-base">{shortName(getName(live.team2Player1Id))}</p>
                                <p className="truncate text-sm font-medium text-gray-900 sm:text-base">{shortName(getName(live.team2Player2Id))}</p>
                              </div>
                            </div>
                            <p className="mt-1 text-center text-[13px] text-gray-400 sm:text-sm">R{live.round} · {modeLabel(live.notes || "1-30")}</p>
                          </>
                        ) : (
                          <div className="mt-2 flex flex-col items-center justify-center py-4 text-gray-300 sm:mt-3 sm:py-6">
                            <Radio className="h-6 w-6 sm:h-7 sm:w-7" />
                            <p className="mt-1 text-[13px] text-gray-400 sm:text-sm">Belum mulai</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            </div>

            {/* All matches chart — grid of compact match cards */}
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase sm:text-base">Semua Pertandingan</h2>
            {roundMatches.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {roundMatches
                  .sort((a, b) => {
                    if (a.status !== "completed" && b.status === "completed") return -1;
                    if (a.status === "completed" && b.status !== "completed") return 1;
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                  })
                  .map((m) => {
                    const courtIdx = (m.courtNumber || 1) - 1;
                    const color = courtColors[courtIdx % courtColors.length];
                    const mIsLive = m.status !== "completed" && ((m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0);
                    const mIsCompleted = m.status === "completed";
                    const t1s = m.scoreTeam1 || 0;
                    const t2s = m.scoreTeam2 || 0;
                    const t1g2 = m.scoreTeam1Game2 || 0;
                    const t2g2 = m.scoreTeam2Game2 || 0;
                    const isTwoGame = (m.notes || "").startsWith("2-21");

                    return (
                      <div key={m.id} className={`rounded-xl border bg-white p-3 shadow-sm ring-1 ring-gray-50 transition-all sm:p-4 ${mIsLive ? `${color.border} border-2 shadow-md` : "border-gray-500"} ${mIsCompleted ? "opacity-80" : ""}`}>
                        {/* Court label + status */}
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[13px] font-bold text-gray-600 sm:text-sm">L{m.courtNumber}</span>
                          {mIsLive ? (
                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700 sm:text-[13px]">
                              <span className="inline-block h-1 w-1 rounded-full bg-green-500" />LIVE
                            </span>
                          ) : mIsCompleted ? (
                            <span className="text-[13px] font-semibold text-green-600 sm:text-sm">✓</span>
                          ) : (
                            <span className="text-xs text-gray-400 sm:text-[13px]">⏳</span>
                          )}
                        </div>

                        {/* Teams + score */}
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <div className="min-w-0 flex-1 text-right">
                            <p className={`truncate text-[13px] font-medium sm:text-sm ${mIsCompleted && m.winnerTeam === 1 ? "font-bold text-green-600" : mIsCompleted && m.winnerTeam === 2 ? "text-gray-400" : "text-gray-900"}`}>{shortName(getName(m.team1Player1Id))}</p>
                            <p className={`truncate text-[13px] font-medium sm:text-sm ${mIsCompleted && m.winnerTeam === 1 ? "font-bold text-green-600" : mIsCompleted && m.winnerTeam === 2 ? "text-gray-400" : "text-gray-900"}`}>{shortName(getName(m.team1Player2Id))}</p>
                          </div>
                          <div className={`flex shrink-0 items-center rounded-md bg-white px-1.5 py-0.5 shadow-sm ring-1 ring-gray-100 sm:px-2 ${mIsCompleted ? "opacity-60" : ""}`}>
                            <span className={`text-base font-black tabular-nums sm:text-lg ${mIsCompleted && m.winnerTeam === 1 ? "text-green-600" : mIsCompleted && m.winnerTeam === 2 ? "text-gray-400" : "text-gray-900"}`}>{t1s}</span>
                            {isTwoGame && <><span className="text-[11px] text-gray-300">/</span><span className={`text-base font-black tabular-nums sm:text-lg ${mIsCompleted && m.winnerTeam === 1 ? "text-green-600" : mIsCompleted && m.winnerTeam === 2 ? "text-gray-400" : "text-gray-900"}`}>{t1g2}</span></>}
                            <span className={`mx-0.5 h-3 w-px sm:mx-1 ${color.bg}`} />
                            <span className={`text-base font-black tabular-nums sm:text-lg ${mIsCompleted && m.winnerTeam === 2 ? "text-blue-600" : mIsCompleted && m.winnerTeam === 1 ? "text-gray-400" : "text-gray-900"}`}>{t2s}</span>
                            {isTwoGame && <><span className="text-[11px] text-gray-300">/</span><span className={`text-base font-black tabular-nums sm:text-lg ${mIsCompleted && m.winnerTeam === 2 ? "text-blue-600" : mIsCompleted && m.winnerTeam === 1 ? "text-gray-400" : "text-gray-900"}`}>{t2g2}</span></>}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className={`truncate text-[13px] font-medium sm:text-sm ${mIsCompleted && m.winnerTeam === 2 ? "font-bold text-blue-600" : mIsCompleted && m.winnerTeam === 1 ? "text-gray-400" : "text-gray-900"}`}>{shortName(getName(m.team2Player1Id))}</p>
                            <p className={`truncate text-[13px] font-medium sm:text-sm ${mIsCompleted && m.winnerTeam === 2 ? "font-bold text-blue-600" : mIsCompleted && m.winnerTeam === 1 ? "text-gray-400" : "text-gray-900"}`}>{shortName(getName(m.team2Player2Id))}</p>
                          </div>
                        </div>

                        <p className="mt-1 text-center text-xs text-gray-400 sm:text-[13px]">R{m.round} · {modeLabel(m.notes || "1-30")}</p>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-12 text-gray-300 sm:py-16">
                <Minus className="h-12 w-12 sm:h-14 sm:w-14" />
                <p className="mt-2 text-sm text-gray-400 sm:text-base">Belum ada pertandingan</p>
                <p className="text-sm text-gray-400 sm:text-base">Buat pertandingan di halaman Sparing</p>
              </div>
            )}
          </div>

          {/* Desktop sidebar */}
          <div className="hidden w-56 shrink-0 overflow-y-auto lg:block lg:w-64 xl:w-72">
            <div className="rounded-2xl bg-white shadow-md ring-1 ring-gray-100">
              <div className="border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
                <h2 className="text-xs font-bold text-gray-900 sm:text-sm">Statistik Round {selRound}</h2>
                <p className="text-[10px] text-gray-500 sm:text-xs">{pbName || "PB"} vs {selectedSparing?.sparingOpponent || "—"}</p>
              </div>

              {/* Win bar */}
              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <div className="mb-2 flex items-center justify-between text-[10px] sm:text-xs">
                  <span className="font-semibold text-green-600">{pbName || "PB Kita"}</span>
                  <span className="text-gray-400">{stats.kitaWins}/{stats.selesai}</span>
                  <span className="font-semibold text-blue-600">{selectedSparing?.sparingOpponent || "Lawan"}</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 sm:h-4">
                  <div
                    className="rounded-l-full bg-green-500 transition-all duration-500"
                    style={{ width: `${stats.selesai > 0 ? (stats.kitaWins / stats.selesai) * 100 : 50}%` }}
                  />
                  <div
                    className="rounded-r-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${stats.selesai > 0 ? (stats.lawanWins / stats.selesai) * 100 : 50}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
                {/* Total matches */}
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-[10px] text-gray-600 sm:text-xs">Total Pertandingan</span>
                  <span className="text-xs font-bold text-gray-900 sm:text-sm">{stats.total}</span>
                </div>

                {/* PB Kita block */}
                <div className="rounded-lg bg-green-50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3 w-3 text-green-600 sm:h-4 sm:w-4" fill="currentColor" />
                    <span className="text-[10px] font-bold text-green-700 sm:text-xs">{pbName || "PB Kita"}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-green-600 sm:text-xs">Menang</span>
                    <span className="text-xs font-black tabular-nums text-green-700 sm:text-sm">{stats.kitaWins}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-green-600 sm:text-xs">Total Poin</span>
                    <span className="text-xs font-black tabular-nums text-green-700 sm:text-sm">{stats.kitaPoints}</span>
                  </div>
                </div>

                {/* Lawan block */}
                <div className="rounded-lg bg-blue-50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3 w-3 text-blue-600 sm:h-4 sm:w-4" fill="currentColor" />
                    <span className="text-[10px] font-bold text-blue-700 sm:text-xs">{selectedSparing?.sparingOpponent || "Lawan"}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-blue-600 sm:text-xs">Menang</span>
                    <span className="text-xs font-black tabular-nums text-blue-700 sm:text-sm">{stats.lawanWins}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-blue-600 sm:text-xs">Total Poin</span>
                    <span className="text-xs font-black tabular-nums text-blue-700 sm:text-sm">{stats.lawanPoints}</span>
                  </div>
                </div>

                {/* Sisa */}
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600 sm:text-xs">Sisa Pertandingan</span>
                    <span className="text-xs font-bold text-gray-900 sm:text-sm">{stats.sisa > 0 ? stats.sisa : "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function modeLabel(notes: string) {
  if (notes.startsWith("2-21")) return "2G21";
  if (notes.startsWith("1-42")) return "1G42";
  return "1G30";
}
