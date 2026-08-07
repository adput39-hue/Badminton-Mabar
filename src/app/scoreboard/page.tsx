"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useControlData } from "@/lib/api-store";
import { listenAllLiveScores, isFirebaseConfigured } from "@/lib/firebase";
import { useWakeLock } from "@/lib/use-wake-lock";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Swords, ChevronLeft, Monitor, Users, ChevronRight, Clock, Radio, Timer, Star, Trophy, Share2, Check, User } from "lucide-react";
import CourtIcon from "@/components/court-icon";
import ShuttlecockIcon from "@/components/shuttlecock-icon";

const courtColors = [
  { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", badge: "bg-green-100 text-green-700", badgeIcon: "text-green-500", liveBadge: "bg-green-500 text-white" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", badge: "bg-blue-100 text-blue-700", badgeIcon: "text-blue-500", liveBadge: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600", badge: "bg-purple-100 text-purple-700", badgeIcon: "text-purple-500", liveBadge: "bg-purple-500 text-white" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", badge: "bg-amber-100 text-amber-700", badgeIcon: "text-amber-500", liveBadge: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-600", badge: "bg-rose-100 text-rose-700", badgeIcon: "text-rose-500", liveBadge: "bg-rose-500 text-white" },
];

export default function ScoreboardPage() {
  useWakeLock();
  const { schedules, members, loaded } = useControlData(60000);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const matchesLoadedRef = useRef(false);
  const liveScoresRef = useRef<Record<string, Record<string, unknown>>>({});
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
              scoreTeam1Game3: (live.scoreTeam1Game3 as number) ?? m.scoreTeam1Game3,
              scoreTeam2Game3: (live.scoreTeam2Game3 as number) ?? m.scoreTeam2Game3,
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
  const [selMabarId, setSelMabarId] = useState<string | null>(null);
  const [selCourt, setSelCourt] = useState<number | null>(null);
  const [courtEntryTimestamps, setCourtEntryTimestamps] = useState<Record<number, number>>({});
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
  const scheduleGameMode: string = savedSettings?.draftGames || savedSettings?.gameMode || "";

  const sparingMatches = useMemo(() => {
    if (isMabarMode) return matches.filter((m) => m.scheduleId === selMabarId);
    return matches.filter((m) => m.scheduleId === selSparingId);
  }, [matches, selSparingId, isMabarMode, selMabarId]);

  const courtMatches = useMemo(() => {
    if (selCourt === null) return [];
    const enteredAt = courtEntryTimestamps[selCourt] || 0;
    return sparingMatches.filter((m) =>
      m.courtNumber === selCourt &&
      (m.status !== "scheduled" || (m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0) &&
      !(m.status === "completed" && new Date(m.updatedAt).getTime() < enteredAt)
    );
  }, [sparingMatches, selCourt, courtEntryTimestamps]);

  const currentMatch = courtMatches.length > 0 ? courtMatches.sort((a, _b) => a.status === "completed" ? 1 : -1)[0] : null;
  const isCompleted = currentMatch?.status === "completed";
  const isLive = currentMatch && !isCompleted;

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  function modeLabel(notes: string) {
    const mode = scheduleGameMode || notes || "1-30";
    if (mode.startsWith("2-21")) return "2 Game 21";
    if (mode.startsWith("1-42")) return "1 Game 42";
    return "1 Game 30";
  }

  const viewRef = useRef({ selSparingId, selMabarId, selCourt, courtEntryTimestamps });
  useEffect(() => { viewRef.current = { selSparingId, selMabarId, selCourt, courtEntryTimestamps }; });

  useEffect(() => {
    const handlePop = () => {
      const v = viewRef.current;
      if (v.selCourt !== null) { setCourtEntryTimestamps((p) => { const n = { ...p }; delete n[v.selCourt!]; return n; }); setSelCourt(null); return; }
      if (v.selSparingId) { setSelSparingId(null); return; }
      if (v.selMabarId) { setSelMabarId(null); return; }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  function fmtDuration(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function raceTo(notes: string) {
    const mode = scheduleGameMode || notes || "1-30";
    if (mode.startsWith("1-30")) return "30";
    if (mode.startsWith("1-42")) return "42";
    return "21";
  }

  function gameLabel(notes: string) {
    const mode = scheduleGameMode || notes || "1-30";
    if (mode.startsWith("2-21")) return "Game Ini";
    const r = raceTo(notes);
    return `Race to ${r} Poin`;
  }

  const dataReady = loaded && matchesLoadedRef.current;
  const [copied, setCopied] = useState(false);

  const currentGameMode: string = scheduleGameMode || (currentMatch?.notes || "") || "1-30";
  const isTwoGame: boolean = currentGameMode.startsWith("2-21");

  function handleShare() {
    const fromStorage = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
    const fromUrl = new URLSearchParams(window.location.search).get("pbId") || "";
    const pbId = fromStorage || fromUrl;
    if (!pbId) return;
    const params = new URLSearchParams();
    params.set("pbId", pbId);
    if (selSparingId) params.set("scheduleId", selSparingId);
    if (selMabarId) params.set("mabarId", selMabarId);
    const url = `${window.location.origin}/scoreboard-live?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!selSparingId && !selMabarId) {
    return (
      <div className="relative min-h-screen bg-[var(--color-bg)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <h1 className="text-xl font-bold text-white sm:text-2xl">Scoreboard</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Pilih sparing untuk menampilkan scoreboard</p>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          {!dataReady ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner />
            </div>
          ) : sparings.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <Swords className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Belum ada sparing</p>
            </div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {sparings.map((s, i) => {
              const sColor = courtColors[i % courtColors.length];
              const totalMatches = matches.filter((m) => m.scheduleId === s.id).length;
              const hasLiveMatches = matches.some((m) => m.scheduleId === s.id && (m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0);
              return (
                <button key={s.id} onClick={() => { history.pushState(null, ""); setSelSparingId(s.id); setCourtEntryTimestamps({}); }}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
                  {hasLiveMatches && (
                    <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-bl-2xl ${sColor.bg}`}>
                      <Star className="h-4 w-4 text-white" fill="white" />
                    </div>
                  )}
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
                    <span className="text-xs text-gray-400">{totalMatches} pertandingan</span>
                    <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
             })}
           </div>
            )}
            {mabarSchedules.length > 0 && (
              <>
                <h2 className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-gray-500">Mabar</h2>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {mabarSchedules.map((s, i) => {
                    const sColor = courtColors[i % courtColors.length];
                    const totalMatches = matches.filter((m) => m.scheduleId === s.id).length;
                    const hasLiveMatches = matches.some((m) => m.scheduleId === s.id && (m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0);
                    return (
                      <button key={s.id} onClick={() => { history.pushState(null, ""); setSelMabarId(s.id); setCourtEntryTimestamps({}); }}
                        className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
                        {hasLiveMatches && (
                          <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-bl-2xl ${sColor.bg}`}>
                            <Star className="h-4 w-4 text-white" fill="white" />
                          </div>
                        )}
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
                          <span className="text-xs text-gray-400">{totalMatches} pertandingan</span>
                          <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
     );
   }

  if (selCourt === null) {
    const savedSettingsLocal = savedSettings;
    const courtList = savedSettingsLocal?.courts as { name: string; startTime: string; endTime: string }[] || [];
    return (
      <div className="relative min-h-screen bg-[var(--color-bg)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <h1 className="text-xl font-bold text-white sm:text-2xl">Pilih Lapangan</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Pilih lapangan untuk melihat pertandingan</p>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {courtList.map((court, i) => {
              const hasLive = sparingMatches.some((m) => m.courtNumber === i + 1 && m.status !== "completed" && (m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0);
              const enteredAt = courtEntryTimestamps[i + 1] || 0;
              const hasDone = enteredAt > 0 && sparingMatches.some((m) => m.courtNumber === i + 1 && m.status === "completed" && new Date(m.updatedAt).getTime() >= enteredAt);
              const color = courtColors[i % courtColors.length];
              const statusText = hasLive ? "Pertandingan Berlangsung" : hasDone ? "Pertandingan Selesai" : "Belum Dimulai";
              return (
                <button key={i} onClick={() => { history.pushState(null, ""); setCourtEntryTimestamps((p) => ({ ...p, [i + 1]: Date.now() })); setSelCourt(i + 1); }}
                  className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md sm:p-5 ${hasLive ? `${color.border} border-2` : "border-gray-500"}`}>
                  {hasLive && (
                    <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-bl-2xl ${color.bg}`}>
                      <Star className="h-4 w-4 text-white" fill="white" />
                    </div>
                  )}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${color.bg}`}>
                      <CourtIcon size={28} color="white" className="sm:size-8" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 sm:text-base">{court.name}</h3>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{court.startTime.slice(0,5)} - {court.endTime.slice(0,5)}</span>
                      </div>
                      {hasLive ? (
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${color.liveBadge}`}>
                          <Radio className="h-2.5 w-2.5" /> LIVE
                        </span>
                      ) : hasDone ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-600">SELESAI</span>
                      ) : (
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${color.badge}`}>
                          <Timer className={`h-2.5 w-2.5 ${color.badgeIcon}`} /> Belum Dimulai
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 sm:mt-4">
                    <div className={`flex items-center gap-2 text-xs font-medium ${hasLive ? color.text : "text-gray-500"}`}>
                      <Users className={`h-3.5 w-3.5 ${hasLive ? "" : "text-gray-400"}`} />
                      {statusText}
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${hasLive ? color.text : "text-gray-400"}`} />
                  </div>
                </button>
              );
            })}
          </div>
          {courtList.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm">
              <CourtIcon size={48} color="#d1d5db" />
              <p className="mt-3 text-sm text-gray-500">Belum ada lapangan</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-bg)] overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-1 pt-1 sm:pb-1.5 sm:pt-1.5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wide text-white uppercase backdrop-blur-sm sm:px-4 sm:py-1.5 sm:text-sm md:px-5 md:py-2 md:text-base lg:text-lg">
              {courts[selCourt - 1]?.name || `Lapangan ${selCourt}`}
            </span>
            <button onClick={handleShare}
              className="flex items-center gap-1 rounded bg-white/15 px-1.5 py-1 text-[10px] text-white transition-colors hover:bg-white/25 sm:px-2.5 sm:py-1.5 sm:text-xs md:px-3 md:py-2 md:text-sm">
              {copied ? <Check className="size-3 sm:size-3.5 md:size-4" /> : <Share2 className="size-3 sm:size-3.5 md:size-4" />}
              <span className="hidden sm:inline">{copied ? "Disalin" : "Bagikan"}</span>
            </button>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {isCompleted ? (
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm sm:px-3 sm:py-1 sm:text-xs md:px-4 md:py-1.5 md:text-sm">SELESAI</span>
            ) : isLive ? (
              <span className="flex items-center gap-1 rounded-full bg-green-400/30 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm sm:px-3 sm:py-1 sm:text-xs md:px-4 md:py-1.5 md:text-sm">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-300 sm:h-2 sm:w-2" />
                LIVE
              </span>
            ) : <span className="text-[10px] text-white/50 sm:text-xs">—</span>}
            <span className="font-mono text-[10px] tabular-nums text-white/60 sm:text-xs md:text-sm">{currentTime}</span>
          </div>
        </div>
      </div>

      <div className="relative mx-auto flex h-[calc(100vh-36px)] w-full max-w-7xl flex-col overflow-hidden p-0.5 sm:h-[calc(100vh-40px)] sm:p-1 md:p-1.5 lg:p-2">
        <div className="flex flex-1 flex-col justify-center overflow-hidden">
          <div className="mx-auto flex w-full flex-1 flex-col justify-center rounded-2xl bg-white shadow-md ring-1 ring-gray-100 p-1 sm:p-1.5 md:p-2 lg:p-3">
            {currentMatch ? (
              (() => {
                const color = courtColors[(selCourt - 1) % courtColors.length];
                const serveTeam = currentMatch ? (() => {
                  const raw = liveScoresRef.current[currentMatch.id]?.lastScorer as number | undefined;
                  if (raw != null) return raw;
                  const s1 = currentMatch.scoreTeam1 || 0;
                  const s2 = currentMatch.scoreTeam2 || 0;
                  if (s1 > s2) return 1;
                  if (s2 > s1) return 2;
                  return null;
                })() : null;
                const isMultiGame = scheduleGameMode.startsWith("2-21");
                const hasG3 = isMultiGame && ((currentMatch.scoreTeam1Game3 || 0) > 0 || (currentMatch.scoreTeam2Game3 || 0) > 0);
                const cols = isMultiGame ? (hasG3 ? 4 : 3) : 2;
                return (
                  <div className={`relative flex flex-1 flex-col rounded-2xl border-[3px] bg-white p-0 sm:p-0.5 md:p-1 ${isLive ? color.border : "border-gray-200"}`}>
                    <div className="flex-1 flex flex-col justify-center">
                      <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(${cols - 1}, min-content)`, gap: "0.125rem 0.5rem", alignItems: "center" }}>
                        <div className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 sm:text-[9px] md:text-[10px]">PASANGAN</div>
                        <div className="text-center text-[8px] font-semibold uppercase tracking-wider text-gray-400 sm:text-[9px] md:text-[10px]">GAME 1</div>
                        {isMultiGame && <div className="text-center text-[8px] font-semibold uppercase tracking-wider text-gray-400 sm:text-[9px] md:text-[10px]">GAME 2</div>}
                        {hasG3 && <div className="text-center text-[8px] font-semibold uppercase tracking-wider text-gray-400 sm:text-[9px] md:text-[10px]">GAME 3</div>}
                        <hr className="border-gray-200" style={{ gridColumn: `1 / span ${cols}` }} />
                        {/* Team 1 */}
                        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                          <ShuttlecockIcon size={48} className="shrink-0 text-green-500 sm:size-14 md:size-16 lg:size-20 xl:size-24" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-gray-900 text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">{getName(currentMatch.team1Player1Id)}</p>
                            <p className="truncate font-bold text-gray-900 text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">{getName(currentMatch.team1Player2Id)}</p>
                          </div>
                          {serveTeam == 1 && <span className="shrink-0 rounded-full bg-green-500 px-2 py-0.5 text-[8px] font-bold text-white sm:text-[9px] md:text-[10px] lg:text-[12px] xl:text-[14px]">SERVE</span>}
                        </div>
                        <div className="flex items-center justify-center">
                          <span className="inline-flex h-28 w-32 items-center justify-center rounded-xl border-[3px] border-green-300 bg-green-50 text-6xl font-bold text-green-700 sm:h-32 sm:w-40 sm:text-7xl md:h-40 md:w-48 md:text-8xl lg:h-48 lg:w-56 lg:text-9xl xl:h-56 xl:w-72 xl:text-9xl">{currentMatch.scoreTeam1 || 0}</span>
                        </div>
                        {isMultiGame && (
                          <div className="flex items-center justify-center">
                            <span className="inline-flex h-28 w-32 items-center justify-center rounded-xl border-[3px] border-green-200 bg-green-50/50 text-6xl font-bold text-green-600 sm:h-32 sm:w-40 sm:text-7xl md:h-40 md:w-48 md:text-8xl lg:h-48 lg:w-56 lg:text-9xl xl:h-56 xl:w-72 xl:text-9xl">{currentMatch.scoreTeam1Game2 || 0}</span>
                          </div>
                        )}
                        {hasG3 && (
                          <div className="flex items-center justify-center">
                            <span className="inline-flex h-28 w-32 items-center justify-center rounded-xl border-[3px] border-green-200 bg-green-50/50 text-6xl font-bold text-green-600 sm:h-32 sm:w-40 sm:text-7xl md:h-40 md:w-48 md:text-8xl lg:h-48 lg:w-56 lg:text-9xl xl:h-56 xl:w-72 xl:text-9xl">{currentMatch.scoreTeam1Game3 || 0}</span>
                          </div>
                        )}
                        <hr className="border-gray-200" style={{ gridColumn: `1 / span ${cols}` }} />
                        {/* Team 2 */}
                        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                          <User size={48} className="shrink-0 text-blue-500 sm:size-14 md:size-16 lg:size-20 xl:size-24" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-gray-900 text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">{getName(currentMatch.team2Player1Id)}</p>
                            <p className="truncate font-bold text-gray-900 text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">{getName(currentMatch.team2Player2Id)}</p>
                          </div>
                          {serveTeam == 2 && <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[8px] font-bold text-white sm:text-[9px] md:text-[10px] lg:text-[12px] xl:text-[14px]">SERVE</span>}
                        </div>
                        <div className="flex items-center justify-center">
                          <span className="inline-flex h-28 w-32 items-center justify-center rounded-xl border-[3px] border-blue-300 bg-blue-50 text-6xl font-bold text-blue-700 sm:h-32 sm:w-40 sm:text-7xl md:h-40 md:w-48 md:text-8xl lg:h-48 lg:w-56 lg:text-9xl xl:h-56 xl:w-72 xl:text-9xl">{currentMatch.scoreTeam2 || 0}</span>
                        </div>
                        {isMultiGame && (
                          <div className="flex items-center justify-center">
                            <span className="inline-flex h-28 w-32 items-center justify-center rounded-xl border-[3px] border-blue-200 bg-blue-50/50 text-6xl font-bold text-blue-600 sm:h-32 sm:w-40 sm:text-7xl md:h-40 md:w-48 md:text-8xl lg:h-48 lg:w-56 lg:text-9xl xl:h-56 xl:w-72 xl:text-9xl">{currentMatch.scoreTeam2Game2 || 0}</span>
                          </div>
                        )}
                        {hasG3 && (
                          <div className="flex items-center justify-center">
                            <span className="inline-flex h-28 w-32 items-center justify-center rounded-xl border-[3px] border-blue-200 bg-blue-50/50 text-6xl font-bold text-blue-600 sm:h-32 sm:w-40 sm:text-7xl md:h-40 md:w-48 md:text-8xl lg:h-48 lg:w-56 lg:text-9xl xl:h-56 xl:w-72 xl:text-9xl">{currentMatch.scoreTeam2Game3 || 0}</span>
                          </div>
                        )}
                        <hr className="border-gray-200" style={{ gridColumn: `1 / span ${cols}` }} />
                        {/* Bottom info */}
                        <div style={{ gridColumn: `1 / span ${cols}` }}>
                          <div className="flex items-center justify-center gap-1 rounded bg-gray-50 px-0.5 py-0 sm:gap-1 sm:px-1">
                            <span className="flex items-center gap-0.5 text-[8px] text-gray-600 sm:text-[9px] md:text-[10px] lg:text-[11px]"><Trophy className="h-2 w-2 text-amber-500 lg:h-2.5 lg:w-2.5" /> Round {currentMatch.round}</span>
                            <span className="h-2 w-px bg-gray-300" />
                            <span className="text-[8px] text-gray-600 sm:text-[9px] md:text-[10px] lg:text-[11px]">Race to {scheduleGameMode.startsWith("1-42") ? "42" : scheduleGameMode.startsWith("2-21") ? "21" : "30"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-16">
                <Monitor className="mx-auto h-12 w-12 text-gray-200 sm:h-16 sm:w-16 md:h-20 md:w-20 lg:h-24 lg:w-24" />
                <p className="mt-3 text-center text-sm text-gray-500 sm:text-base md:text-lg lg:text-xl">Tidak ada pertandingan</p>
                <p className="mt-1 text-center text-[10px] text-gray-400 sm:text-xs md:text-sm lg:text-base">Pilih lapangan lain atau mulai pertandingan</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


