"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useControlData } from "@/lib/api-store";
import { listenAllLiveScores, isFirebaseConfigured } from "@/lib/firebase";
import { useWakeLock } from "@/lib/use-wake-lock";
import type { ApiMatch, ApiSchedule, ApiMember, ApiTournament, ApiTeam } from "@/lib/api-types";
import {
  Swords, ChevronLeft, Minus, Trophy, Share2, Check,
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
  useWakeLock();
  const { schedules, members, tournaments, loaded } = useControlData(60000);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const matchesLoadedRef = useRef(false);
  useEffect(() => {
    const pbId = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
    function fetchMatches() {
      fetch("/api/matches", { headers: { "x-pb-id": pbId } })
        .then((r) => r.json())
        .then((data) => { setMatches(data); matchesLoadedRef.current = true; })
        .catch(() => { matchesLoadedRef.current = true; });
    }
    fetchMatches();
    if (isFirebaseConfigured()) {
      const seen = new Set<string>();
      const unsub = listenAllLiveScores((scores) => {
        setMatches((prev) => {
          const seenIds = new Set(prev.map((m) => m.id));
          const newIds = Object.keys(scores).filter((id) => !seenIds.has(id));
          if (newIds.length > 0 && !seen.has(newIds[0])) {
            newIds.forEach((id) => seen.add(id));
            const pbId = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
            fetch(`/api/matches?ids=${newIds.join(",")}`, { headers: { "x-pb-id": pbId } })
              .then((r) => { if (r.ok) return r.json(); throw new Error(); })
              .then((newMatches) => { setMatches((p) => [...p, ...newMatches]); })
              .catch(() => {});
          }
          const merged = prev.map((m) => {
            const live = scores[m.id];
            if (!live) return m;
            return {
              ...m,
              courtNumber: (live.courtNumber as number) ?? m.courtNumber,
              scoreTeam1: (live.scoreTeam1 as number) ?? m.scoreTeam1,
              scoreTeam2: (live.scoreTeam2 as number) ?? m.scoreTeam2,
              scoreTeam1Game2: (live.scoreTeam1Game2 as number) ?? m.scoreTeam1Game2,
              scoreTeam2Game2: (live.scoreTeam2Game2 as number) ?? m.scoreTeam2Game2,
              status: (live.status as string) || m.status,
              winnerTeam: (live.winnerTeam as number) ?? m.winnerTeam,
            };
          });
          return merged;
        });
      });
      return () => { if (unsub) unsub(); };
    }
    const es = new EventSource(`/api/matches/stream${pbId ? `?pbId=${pbId}` : ""}`);
    es.onmessage = fetchMatches;
    return () => { es.close(); };
  }, []);

  const [selSparingId, setSelSparingId] = useState<string | null>(null);
  const [selTournamentId, setSelTournamentId] = useState<string | null>(null);
  const [selMabarId, setSelMabarId] = useState<string | null>(null);
  const [mode, setMode] = useState<"sparing" | "turnamen">("sparing");
  const [selRound, setSelRound] = useState(1);
  const [pbName, setPbName] = useState("");
  const [pbLogo, setPbLogo] = useState("");
  const [tournamentDetail, setTournamentDetail] = useState<ApiTournament | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.pb?.name) setPbName(u.pb.name);
        if (u.pb?.logoUrl) setPbLogo(u.pb.logoUrl);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schedId = params.get("scheduleId");
    const mabarId = params.get("mabarId");
    const tourneyId = params.get("tournamentId");
    if (schedId) { window.history.pushState(null, ""); setSelSparingId(schedId); }
    else if (mabarId) { window.history.pushState(null, ""); setSelMabarId(mabarId); }
    else if (tourneyId) { window.history.pushState(null, ""); setSelTournamentId(tourneyId); }
  }, []);

  const sparings = useMemo(() =>
    schedules.filter((s) => s.sparingOpponent).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [schedules]);

  const mabarSchedules = useMemo(() =>
    schedules.filter((s) => !s.sparingOpponent && !s.tournamentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [schedules]);

  const selectedSparing = sparings.find((s) => s.id === selSparingId);
  const selectedMabar = mabarSchedules.find((s) => s.id === selMabarId);
  const isMabarMode = !!selMabarId;

  const savedSettings = useMemo(() => {
    const s = isMabarMode ? selectedMabar : selectedSparing;
    if (!s?.notes) return null;
    try { return JSON.parse(s.notes); } catch { return null; }
  }, [isMabarMode, selectedMabar, selectedSparing]);

  const courts: { name: string; startTime: string; endTime: string }[] = savedSettings?.courts || [];
  const totalRounds: number = savedSettings?.totalRounds || 1;

  const sparingMatches = useMemo(() => {
    if (isMabarMode) return matches.filter((m) => m.scheduleId === selMabarId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return matches.filter((m) => m.scheduleId === selSparingId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [matches, selSparingId, isMabarMode, selMabarId]);

  const roundMatches = useMemo(() =>
    sparingMatches.filter((m) => m.round === selRound),
  [sparingMatches, selRound]);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  const roundStatsMap = useMemo(() => {
    const map: Record<number, { kitaWins: number; lawanWins: number }> = {};
    for (let r = 1; r <= totalRounds; r++) {
      const rm = sparingMatches.filter((m) => m.round === r);
      const completed = rm.filter((m) => m.status === "completed");
      map[r] = {
        kitaWins: completed.filter((m) => m.winnerTeam === 1).length,
        lawanWins: completed.filter((m) => m.winnerTeam === 2).length,
      };
    }
    return map;
  }, [sparingMatches, totalRounds]);

  const finalStats = useMemo(() => {
    let kitaWins = 0, lawanWins = 0;
    for (let r = 1; r <= totalRounds; r++) {
      kitaWins += roundStatsMap[r]?.kitaWins || 0;
      lawanWins += roundStatsMap[r]?.lawanWins || 0;
    }
    return { kitaWins, lawanWins };
  }, [roundStatsMap, totalRounds]);

  const viewRef = useRef({ selSparingId, selTournamentId, selMabarId });
  useEffect(() => { viewRef.current = { selSparingId, selTournamentId, selMabarId }; });

  useEffect(() => {
    const handlePop = () => {
      const v = viewRef.current;
      if (v.selSparingId) { setSelSparingId(null); }
      if (v.selTournamentId) { setSelTournamentId(null); }
      if (v.selMabarId) { setSelMabarId(null); }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const dataReady = loaded && matchesLoadedRef.current;

  function handleShare() {
    const fromStorage = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
    const fromUrl = new URLSearchParams(window.location.search).get("pbId") || "";
    const pbId = fromStorage || fromUrl;
    if (!pbId) return;
    const params = new URLSearchParams();
    params.set("pbId", pbId);
    if (selSparingId) params.set("scheduleId", selSparingId);
    if (selMabarId) params.set("mabarId", selMabarId);
    if (selTournamentId) params.set("tournamentId", selTournamentId);
    const url = `${window.location.origin}/scoreboard-live?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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

  if (!selSparingId && !selTournamentId && !selMabarId) {
    return (
      <div className="relative min-h-screen bg-[var(--color-bg)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <h1 className="text-xl font-bold text-white sm:text-2xl">Scoreboard Live</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Pilih sparing, league, atau mabar</p>
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

            {/* League */}
            <h2 className="mb-3 text-sm font-bold text-gray-700">League</h2>
            {tournaments.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada league</p>
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

            {/* Mabar */}
            <h2 className="mb-3 mt-6 text-sm font-bold text-gray-700">Mabar</h2>
            {mabarSchedules.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada mabar</p>
            ) : (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {mabarSchedules.map((s, i) => {
                const sColor = courtColors[i % courtColors.length];
                return (
                  <button key={s.id} onClick={() => { history.pushState(null, ""); setSelMabarId(s.id); }}
                    className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${sColor.bg}`}>
                        <Swords className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 sm:text-base">{s.title || "Mabar"}</h3>
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
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="mt-2 text-lg font-bold text-white sm:text-xl">{tournamentDetail?.name || "League"}</h1>
                <p className="text-xs text-white/60">{tournamentTeams.length} tim · {tournamentScheds.length} sesi</p>
              </div>
              <button onClick={handleShare}
                className="flex items-center gap-1 rounded bg-white/15 px-2 py-1 text-xs text-white transition-colors hover:bg-white/25">
                {copied ? <Check className="size-3" /> : <Share2 className="size-3" />}
                {copied ? "Disalin" : "Bagikan"}
              </button>
            </div>
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
      {/* Red Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-md">
        <div className="mx-auto max-w-[1440px] px-3 pt-2 sm:px-4 sm:pt-3">
          {/* Top bar: title + date */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-[10px] font-bold tracking-wider uppercase sm:text-xs">{isMabarMode ? (selectedMabar?.title || "MABAR").toUpperCase() : `${(pbName || "PB").toUpperCase()} vs ${(selectedSparing?.sparingOpponent || "—").toUpperCase()}`}</h1>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs">
              <button onClick={handleShare}
                className="flex items-center gap-1 rounded bg-white/15 px-1.5 py-1 text-white transition-colors hover:bg-white/25">
                {copied ? <Check className="size-3" /> : <Share2 className="size-3" />}
                <span className="hidden sm:inline">{copied ? "Disalin" : "Bagikan"}</span>
              </button>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:size-3.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>{new Date((isMabarMode ? selectedMabar : selectedSparing)?.date || "").toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
            </div>
          </div>

          {/* Big total score */}
          <div className="mt-1.5 flex items-center justify-center gap-3 sm:mt-2 sm:gap-4">
            {!isMabarMode ? (
              <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white text-[10px] font-bold text-gray-700 sm:h-9 sm:w-9 sm:text-xs">{pbLogo ? <img src={pbLogo} alt="" className="h-full w-full object-cover" /> : "PB"}</div>
                <span className="text-sm font-bold sm:text-base">{pbName || "PB Testing"}</span>
              </div>
              <div className="text-[34px] font-black tabular-nums sm:text-[40px]">
                <span>{finalStats.kitaWins}</span>
                <span className="mx-2 text-white/60 sm:mx-3">-</span>
                <span>{finalStats.lawanWins}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm font-bold sm:text-base">{selectedSparing?.sparingOpponent || "TSES"}</span>
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white text-[10px] font-bold text-gray-700 sm:h-9 sm:w-9 sm:text-xs">{selectedSparing?.logoUrl ? <img src={selectedSparing.logoUrl} alt="" className="h-full w-full object-cover" /> : (selectedSparing?.sparingOpponent || "T").slice(0, 4).toUpperCase()}</div>
              </div>
              </div>
            ) : (
              <div className="text-sm font-bold text-white/80">{sparingMatches.length} pertandingan</div>
            )}
          </div>

          {/* Round stat cards */}
          {totalRounds > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-3 sm:gap-3">
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
                const s = roundStatsMap[r];
                const kita = s?.kitaWins || 0;
                const lawan = s?.lawanWins || 0;
                return (
                  <div key={r} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-1.5 sm:text-xs">
                    <span className="font-semibold text-white/80">Round {r}</span>
                    <span className="text-white/60">:</span>
                    <span className="font-bold tabular-nums">{kita}</span>
                    <span className="text-white/60">-</span>
                    <span className="font-bold tabular-nums">{lawan}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Round tabs */}
        {totalRounds > 1 && (
          <div className="mt-2 flex border-b border-white/10">
            <div className="mx-auto flex w-full max-w-[1440px] gap-1 px-3 sm:px-4">
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                <button key={r} onClick={() => setSelRound(r)}
                  className={`relative px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${selRound === r ? "text-white" : "text-white/60 hover:text-white/90"}`}>
                  Round {r}
                  {selRound === r && <span className="absolute right-0 bottom-0 left-0 h-0.5 bg-white" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-hidden p-2 sm:p-3 md:p-4">
        <div className="flex-1 overflow-y-auto">
          {/* Sedang Berlangsung */}
          <div className="mb-3 sm:mb-4">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              <h2 className="text-[10px] font-semibold tracking-wide text-gray-700 uppercase sm:text-xs">SEDANG BERLANGSUNG</h2>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {courts.map((court, i) => {
                const color = courtColors[i % courtColors.length];
                const liveMatches = sparingMatches.filter((m) => m.courtNumber === i + 1 && m.status !== "completed");
                const live = liveMatches[0] || null;
                const hasLive = !!live;
                return (
                  <div key={i} className={`relative flex min-h-[150px] flex-col rounded-xl border-2 bg-white p-3 shadow-sm sm:min-h-[170px] sm:p-4 ${hasLive ? color.border : "border-gray-200"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-gray-900 sm:text-base">{court.name}</h3>
                      {hasLive ? (
                        <span className="flex items-center gap-1 rounded bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white sm:text-xs">
                          ● LIVE
                        </span>
                      ) : null}
                    </div>
                    {hasLive && live ? (
                      <>
                        <div className="mt-2 flex items-center justify-center gap-2 sm:mt-3 sm:gap-3">
                          <div className="min-w-0 flex-1 text-right">
                            <p className="truncate text-base font-medium text-gray-900 sm:text-lg">{getName(live.team1Player1Id)}</p>
                            <p className="truncate text-base font-medium text-gray-900 sm:text-lg">{getName(live.team1Player2Id)}</p>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 shadow-sm ring-1 ring-gray-100 sm:gap-2 sm:px-3 sm:py-1.5">
                            {(live.notes || "").startsWith("2-21") ? (
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <span className="text-[22px] font-black tabular-nums text-gray-900 sm:text-2xl">{live.scoreTeam1 || 0}</span>
                                <span className="text-xs text-gray-300">/</span>
                                <span className="text-[22px] font-black tabular-nums text-gray-900 sm:text-2xl">{live.scoreTeam1Game2 || 0}</span>
                              </div>
                            ) : (
                              <span className="text-[22px] font-black tabular-nums text-gray-900 sm:text-2xl">{live.scoreTeam1 || 0}</span>
                            )}
                            <span className={`mx-1 h-4 w-0.5 sm:mx-1.5 ${color.bg}`} />
                            {(live.notes || "").startsWith("2-21") ? (
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <span className="text-[22px] font-black tabular-nums text-gray-900 sm:text-2xl">{live.scoreTeam2 || 0}</span>
                                <span className="text-xs text-gray-300">/</span>
                                <span className="text-[22px] font-black tabular-nums text-gray-900 sm:text-2xl">{live.scoreTeam2Game2 || 0}</span>
                              </div>
                            ) : (
                              <span className="text-[22px] font-black tabular-nums text-gray-900 sm:text-2xl">{live.scoreTeam2 || 0}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-base font-medium text-gray-900 sm:text-lg">{getName(live.team2Player1Id)}</p>
                            <p className="truncate text-base font-medium text-gray-900 sm:text-lg">{getName(live.team2Player2Id)}</p>
                          </div>
                        </div>
                        <p className="mt-1 text-center text-[10px] text-gray-400 sm:text-xs">R{live.round} · {modeLabel(live.notes || "1-30")}</p>
                      </>
                    ) : (
                      <div className="mt-2 flex flex-1 flex-col items-center justify-center py-3 text-gray-300 sm:mt-3 sm:py-6">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="sm:size-10">
                          <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                          <path d="m22 8-2 4 2 4"></path>
                          <path d="M2 12h20"></path>
                        </svg>
                        <p className="mt-1 text-[10px] text-gray-400 sm:text-xs">Belum mulai</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hasil Pertandingan */}
          <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-gray-700 uppercase sm:text-xs">Hasil Pertandingan</h2>
          {roundMatches.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
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
                    <div key={m.id} className={`relative rounded-xl border bg-white p-2 shadow-sm ring-1 ring-gray-50 transition-all sm:p-3 ${mIsLive ? `${color.border} border-2` : "border-gray-200"} ${mIsCompleted ? "" : ""}`}>
                      {/* Court label + status */}
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-700 sm:text-xs">
                          <span className={`flex items-center justify-center rounded px-1 py-0.5 text-[9px] font-black text-white sm:px-1.5 sm:py-1 sm:text-xs ${color.bg}`}>{courts[courtIdx]?.name || courtIdx + 1}</span>
                          {mIsLive ? (
                            <span className="text-green-600">● LIVE</span>
                          ) : mIsCompleted ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">⏳</span>
                          )}
                        </span>
                      </div>

                      {/* Teams */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted && m.winnerTeam === 1 ? "font-bold text-gray-900" : mIsCompleted && m.winnerTeam === 2 ? "text-gray-400" : "text-gray-800"}`}>{getName(m.team1Player1Id)}</p>
                            <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted && m.winnerTeam === 1 ? "font-bold text-gray-900" : mIsCompleted && m.winnerTeam === 2 ? "text-gray-400" : "text-gray-800"}`}>{getName(m.team1Player2Id)}</p>
                          </div>
                          <span className={`shrink-0 text-xs font-bold tabular-nums sm:text-sm ${mIsCompleted && m.winnerTeam === 1 ? "text-gray-900" : mIsCompleted && m.winnerTeam === 2 ? "text-gray-400" : "text-gray-800"}`}>{t1s}{isTwoGame ? `, ${t1g2}` : ""}</span>
                        </div>
                        <hr className="border-black/50" />
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted && m.winnerTeam === 2 ? "font-bold text-gray-900" : mIsCompleted && m.winnerTeam === 1 ? "text-gray-400" : "text-gray-800"}`}>{getName(m.team2Player1Id)}</p>
                            <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted && m.winnerTeam === 2 ? "font-bold text-gray-900" : mIsCompleted && m.winnerTeam === 1 ? "text-gray-400" : "text-gray-800"}`}>{getName(m.team2Player2Id)}</p>
                          </div>
                          <span className={`shrink-0 text-xs font-bold tabular-nums sm:text-sm ${mIsCompleted && m.winnerTeam === 2 ? "text-gray-900" : mIsCompleted && m.winnerTeam === 1 ? "text-gray-400" : "text-gray-800"}`}>{t2s}{isTwoGame ? `, ${t2g2}` : ""}</span>
                        </div>
                      </div>

                      <p className="text-center text-[9px] text-gray-400 sm:text-[10px]">R{m.round} · {modeLabel(m.notes || "1-30")}</p>
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

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[10px] text-gray-500 sm:gap-3 sm:text-xs">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>Sedang Berlangsung</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-300" />
              <span>Belum Dimulai</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-green-600">✓</span>
              <span>Selesai</span>
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


