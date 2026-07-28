"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useControlData } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember, ApiTournament, ApiTeam } from "@/lib/api-types";
import {
  Swords, ChevronLeft, Radio, Minus, Trophy,
} from "lucide-react";
import ShuttlecockIcon from "@/components/shuttlecock-icon";
import { LoadingSpinner } from "@/components/loading-spinner";

const courtColors = [
  { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50", border: "border-green-500" },
  { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-500" },
  { bg: "bg-purple-500", text: "text-purple-600", light: "bg-purple-50", border: "border-purple-500" },
  { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-500" },
  { bg: "bg-rose-500", text: "text-rose-600", light: "bg-rose-50", border: "border-rose-500" },
];

export default function ScoreboardLivePage() {
  const { schedules, members, tournaments, loaded } = useControlData(60000);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const matchesLoadedRef = useRef(false);
  useEffect(() => {
    const pbId = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
    fetch("/api/matches", { headers: { "x-pb-id": pbId } })
      .then((r) => r.json())
      .then((data) => { setMatches(data); matchesLoadedRef.current = true; })
      .catch(() => { matchesLoadedRef.current = true; });
    const es = new EventSource(`/api/matches/stream${pbId ? `?pbId=${pbId}` : ""}`);
    es.onmessage = () => {
      fetch("/api/matches", { headers: { "x-pb-id": pbId } })
        .then((r) => r.json())
        .then((data) => setMatches(data))
        .catch(() => {});
    };
    return () => es.close();
  }, []);

  const [selSparingId, setSelSparingId] = useState<string | null>(null);
  const [selTournamentId, setSelTournamentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"sparing" | "turnamen">("sparing");
  const [selRound, setSelRound] = useState(1);
  const [pbName, setPbName] = useState("");
  const [tournamentDetail, setTournamentDetail] = useState<ApiTournament | null>(null);

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

  const roundStatsMap = useMemo(() => {
    const map: Record<number, { kitaWins: number; lawanWins: number; total: number; completed: number }> = {};
    for (let r = 1; r <= totalRounds; r++) {
      const rm = sparingMatches.filter((m) => m.round === r);
      const completed = rm.filter((m) => m.status === "completed");
      map[r] = {
        total: rm.length,
        completed: completed.length,
        kitaWins: completed.filter((m) => m.winnerTeam === 1).length,
        lawanWins: completed.filter((m) => m.winnerTeam === 2).length,
      };
    }
    return map;
  }, [sparingMatches, totalRounds]);

  const allRoundsDone = useMemo(() => {
    if (totalRounds === 0) return false;
    for (let r = 1; r <= totalRounds; r++) {
      const s = roundStatsMap[r];
      if (!s || s.total === 0 || s.completed < s.total) return false;
    }
    return true;
  }, [roundStatsMap, totalRounds]);

  const finalStats = useMemo(() => {
    let kitaWins = 0, lawanWins = 0;
    for (let r = 1; r <= totalRounds; r++) {
      kitaWins += roundStatsMap[r]?.kitaWins || 0;
      lawanWins += roundStatsMap[r]?.lawanWins || 0;
    }
    return { kitaWins, lawanWins };
  }, [roundStatsMap, totalRounds]);

  const viewRef = useRef({ selSparingId, selTournamentId });
  useEffect(() => { viewRef.current = { selSparingId, selTournamentId }; });

  useEffect(() => {
    const handlePop = () => {
      const v = viewRef.current;
      if (v.selSparingId) { setSelSparingId(null); }
      if (v.selTournamentId) { setSelTournamentId(null); }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const dataReady = loaded && matchesLoadedRef.current;

  useEffect(() => {
    if (!selTournamentId) { setTournamentDetail(null); return; }
    fetch(`/api/tournaments/${selTournamentId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTournamentDetail(d));
  }, [selTournamentId]);

  const tournamentScheds = useMemo(() => (tournamentDetail?.schedules || []).filter((s): s is typeof s & { team1Id: string; team2Id: string } => !!s.team1Id && !!s.team2Id), [tournamentDetail]);
  const tournamentTeams = useMemo(() => tournamentDetail?.teams || [], [tournamentDetail]);
  const tourneyMatches = useMemo(() => matches.filter((m) => tournamentScheds.some((s) => s.id === m.scheduleId)), [matches, tournamentScheds]);

  function getTeamName(teamId: string) { return tournamentTeams.find((t) => t.id === teamId)?.name || "—"; }
  function getTeamColor(teamId: string) { return tournamentTeams.find((t) => t.id === teamId)?.color || "#0d9488"; }

  const standings = useMemo(() => {
    const map = new Map<string, { team: { id: string; name: string; color: string; icon?: string | null }; played: number; won: number; lost: number; points: number }>();
    for (const t of tournamentTeams) {
      map.set(t.id, { team: { id: t.id, name: t.name, color: t.color, icon: t.icon }, played: 0, won: 0, lost: 0, points: 0 });
    }
    for (const s of tournamentScheds) {
      const schedMatches = tourneyMatches.filter((m) => m.scheduleId === s.id);
      for (const m of schedMatches) {
        if (m.winnerTeam == null) continue;
        const t1 = map.get(s.team1Id);
        const t2 = map.get(s.team2Id);
        if (!t1 || !t2) continue;
        if (m.winnerTeam === 1) { t1.won++; t2.lost++; t1.points += 1; t2.points -= 1; }
        else if (m.winnerTeam === 2) { t2.won++; t1.lost++; t2.points += 1; t1.points -= 1; }
        t1.played++; t2.played++;
      }
    }
    return [...map.values()].sort((a, b) => b.points - a.points || b.won - a.won);
  }, [tournamentTeams, tournamentScheds, tourneyMatches]);

  if (!selSparingId && !selTournamentId) {
    return (
      <div className="relative min-h-screen bg-[var(--color-bg)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25">
              <ChevronLeft className="h-4 w-4" /> Kembali
            </Link>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Scoreboard Live</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Pilih sparing atau turnamen</p>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          {!dataReady ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner />
            </div>
          ) : (<>
            {/* Sparing */}
            <h2 className="mb-3 text-sm font-bold text-gray-700">Sparing</h2>
            {sparings.length === 0 ? (
              <p className="mb-6 text-xs text-gray-400">Belum ada sparing</p>
            ) : (
            <div className="mb-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {sparings.map((s, i) => {
                const sColor = courtColors[i % courtColors.length];
                return (
                  <button key={s.id} onClick={() => { history.pushState(null, ""); setSelSparingId(s.id); }}
                    className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
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
            )}

            {/* Turnamen */}
            <h2 className="mb-3 text-sm font-bold text-gray-700">Turnamen</h2>
            {tournaments.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada turnamen</p>
            ) : (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {tournaments.map((t) => (
                <button key={t.id} onClick={() => { history.pushState(null, ""); setSelTournamentId(t.id); }}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-500 sm:h-14 sm:w-14">
                      <span className="text-base font-bold text-white sm:text-lg">{t.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 sm:text-base">{t.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">{t.teams?.length || 0} tim · {t.status}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 sm:mt-4">
                    <span className="text-xs text-gray-400">{t._count?.schedules || 0} sesi</span>
                    <ChevronLeft className="h-4 w-4 -rotate-180 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
            )}
          </>)}
        </div>
      </div>
    );
  }



  if (selTournamentId) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-3 pt-3 sm:pb-4 sm:pt-4">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-[1440px] px-3 sm:px-4">
            <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/25 sm:text-sm">
              <ChevronLeft className="h-3.5 w-3.5" /> Kembali
            </button>
            <h1 className="mt-2 text-lg font-bold text-white sm:text-xl">{tournamentDetail?.name || "Turnamen"}</h1>
            <p className="text-xs text-white/60">{tournamentTeams.length} tim · {tournamentScheds.length} sesi</p>
          </div>
        </div>
        <div className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-4 overflow-auto p-3 lg:grid-cols-[1fr_320px] lg:p-4">
          {/* Matches */}
          <div className="space-y-3">
            {tournamentScheds.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-gray-300">
                <Minus className="h-14 w-14" />
                <p className="mt-2 text-sm text-gray-400">Belum ada sesi pertandingan</p>
              </div>
            ) : (
              tournamentScheds.map((s) => {
                const schedMatches = tourneyMatches.filter((m) => m.scheduleId === s.id);
                const completed = schedMatches.filter((m) => m.winnerTeam != null).length;
                return (
                  <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">VS</span>
                        <span>{getTeamName(s.team1Id)}</span>
                        <span className="text-xs text-gray-400">vs</span>
                        <span>{getTeamName(s.team2Id)}</span>
                      </div>
                      <span className="text-xs text-gray-400">{completed}/{schedMatches.length} ganda</span>
                    </div>
                    {schedMatches.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">Belum ada ganda</p>
                    ) : (
                      <div className="space-y-2">
                        {schedMatches.map((m) => {
                          const isCompleted = m.winnerTeam != null;
                          const t1s = m.scoreTeam1 || 0;
                          const t2s = m.scoreTeam2 || 0;
                          const isLive = !isCompleted && (t1s + t2s > 0);
                          return (
                            <div key={m.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${isLive ? "border-green-300 bg-green-50" : "border-gray-100"}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`truncate font-medium ${isCompleted && m.winnerTeam === 1 ? "text-green-600" : "text-gray-700"}`}>{getName(m.team1Player1Id)}</span>
                                <span className="text-gray-300">&</span>
                                <span className={`truncate font-medium ${isCompleted && m.winnerTeam === 1 ? "text-green-600" : "text-gray-700"}`}>{getName(m.team1Player2Id)}</span>
                              </div>
                              <div className="mx-3 flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-sm font-bold">
                                <span className={isCompleted && m.winnerTeam === 1 ? "text-green-600" : "text-gray-800"}>{t1s}</span>
                                <span className="text-gray-300">:</span>
                                <span className={isCompleted && m.winnerTeam === 2 ? "text-blue-600" : "text-gray-800"}>{t2s}</span>
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`truncate font-medium ${isCompleted && m.winnerTeam === 2 ? "text-blue-600" : "text-gray-700"}`}>{getName(m.team2Player1Id)}</span>
                                <span className="text-gray-300">&</span>
                                <span className={`truncate font-medium ${isCompleted && m.winnerTeam === 2 ? "text-blue-600" : "text-gray-700"}`}>{getName(m.team2Player2Id)}</span>
                              </div>
                              {isLive && <span className="ml-2 flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />LIVE</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Standings sidebar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-gray-700">Klasemen</h2>
            {standings.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">Belum ada data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">Tim</th>
                      <th className="pb-2 pr-2 text-center">M</th>
                      <th className="pb-2 pr-2 text-center">W</th>
                      <th className="pb-2 pr-2 text-center">L</th>
                      <th className="pb-2 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.team.id} className="border-b border-gray-50">
                        <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 pr-2 font-medium">
                          <div className="flex items-center gap-1.5">
                            {s.team.icon ? <img src={s.team.icon} alt="" className="h-4 w-4 rounded object-cover" /> : <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.team.color }} />}
                            {s.team.name}
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-center">{s.played}</td>
                        <td className="py-2 pr-2 text-center text-green-600">{s.won}</td>
                        <td className="py-2 pr-2 text-center text-red-500">{s.lost}</td>
                        <td className="py-2 text-center font-bold text-lg">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-3 pt-3 sm:pb-4 sm:pt-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-[1440px] px-3 sm:px-4">
          <div className="flex items-center justify-between">
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

          {/* Round stats */}
          <div className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5 sm:mt-2 sm:pt-2">
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
              const s = roundStatsMap[r];
              if (!s || s.total === 0) return null;
              return (
                <div key={r} className="flex items-center gap-1.5 text-[13px] text-white/90 sm:text-sm">
                  <span className="w-16 shrink-0 text-right text-white/50">Round {r}</span>
                  <span className="text-white/40">:</span>
                  <span className="ml-1.5 font-semibold text-white">{pbName || "PB"}</span>
                  <span className="ml-1.5 font-black tabular-nums text-white">{s.kitaWins}</span>
                  <span className="mx-1.5 text-white/40">vs</span>
                  <span className="font-black tabular-nums text-white">{s.lawanWins}</span>
                  <span className="ml-1.5 font-semibold text-white">{selectedSparing?.sparingOpponent || "Lawan"}</span>
                </div>
              );
            })}
            {allRoundsDone && finalStats && (
              <>
                <div className="border-t border-white/10" />
                <div className="flex items-center gap-1.5 text-sm font-bold text-white sm:text-base">
                  <span className="w-16 shrink-0 text-right text-white/50">FINAL</span>
                  <span className="text-white/40">:</span>
                  <span className="ml-1.5 text-white">{pbName || "PB"}</span>
                  <span className="ml-1.5 font-black tabular-nums text-white">{finalStats.kitaWins}</span>
                  <span className="mx-1.5 text-white/40">vs</span>
                  <span className="font-black tabular-nums text-white">{finalStats.lawanWins}</span>
                  <span className="ml-1.5 text-white">{selectedSparing?.sparingOpponent || "Lawan"}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-hidden p-2 sm:p-3 md:p-4">
        <div className="flex-1 overflow-y-auto">
            {/* Round selector */}
            {totalRounds > 1 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase sm:text-xs">Round:</span>
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                  <button key={r} onClick={() => setSelRound(r)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all sm:text-sm ${selRound === r ? "bg-[var(--color-primary)] text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
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
      </div>
    </div>
  );
}

function modeLabel(notes: string) {
  if (notes.startsWith("2-21")) return "2G21";
  if (notes.startsWith("1-42")) return "1G42";
  return "1G30";
}


