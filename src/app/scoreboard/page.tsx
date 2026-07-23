"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api-store";
import { supabase } from "@/lib/supabase";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { Swords, ChevronLeft, Monitor, Users, ChevronRight, Clock, Radio, Timer, Star, Trophy } from "lucide-react";
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
  const { items: schedules } = useApi<ApiSchedule>("schedules");
  const { items: members } = useApi<ApiMember>("members");
  const { items: matches, refresh: refreshMatches } = useApi<ApiMatch>("matches");

  const [selSparingId, setSelSparingId] = useState<string | null>(null);
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

  const selectedSparing = sparings.find((s) => s.id === selSparingId);

  const savedSettings = useMemo(() => {
    if (!selectedSparing?.notes) return null;
    try { return JSON.parse(selectedSparing.notes); } catch { return null; }
  }, [selectedSparing]);

  const courts: { name: string; startTime: string; endTime: string }[] = savedSettings?.courts || [];

  const sparingMatches = useMemo(() =>
    matches.filter((m) => m.scheduleId === selSparingId),
  [matches, selSparingId]);

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
    if (notes.startsWith("2-21")) return "2 Game 21";
    if (notes.startsWith("1-42")) return "1 Game 42";
    return "1 Game 30";
  }

  useEffect(() => {
    if (!selSparingId) return;
    const channel = supabase
      .channel("scoreboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        refreshMatches();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selSparingId, refreshMatches]);

  const viewRef = useRef({ selSparingId, selCourt, courtEntryTimestamps });
  useEffect(() => { viewRef.current = { selSparingId, selCourt, courtEntryTimestamps }; });

  useEffect(() => {
    const handlePop = () => {
      const v = viewRef.current;
      if (v.selCourt !== null) { setCourtEntryTimestamps((p) => { const n = { ...p }; delete n[v.selCourt!]; return n; }); setSelCourt(null); return; }
      if (v.selSparingId) { setSelSparingId(null); return; }
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
    if (notes.startsWith("1-30")) return "30";
    if (notes.startsWith("1-42")) return "42";
    return "21";
  }

  function gameLabel(notes: string) {
    if (notes.startsWith("2-21")) return "Game Ini";
    const r = raceTo(notes);
    return `Race to ${r} Poin`;
  }

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
            <h1 className="text-xl font-bold text-white sm:text-2xl">Scoreboard</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Pilih sparing untuk menampilkan scoreboard</p>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {sparings.map((s, i) => {
              const sColor = courtColors[i % courtColors.length];
              const totalMatches = matches.filter((m) => m.scheduleId === s.id).length;
              const hasLiveMatches = matches.some((m) => m.scheduleId === s.id && (m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0);
              return (
                <button key={s.id} onClick={() => { history.pushState(null, ""); setSelSparingId(s.id); setCourtEntryTimestamps({}); }}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488] sm:p-5">
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

  if (selCourt === null) {
    const savedSettingsLocal = savedSettings;
    const courtList = savedSettingsLocal?.courts as { name: string; startTime: string; endTime: string }[] || [];
    return (
      <div className="relative min-h-screen bg-[#f0fdfa]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <button onClick={() => window.history.back()} className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25">
              <ChevronLeft className="h-4 w-4" /> Kembali
            </button>
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
    <div className="relative min-h-screen bg-[#f0fdfa] overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-3 pt-3 sm:pb-4 sm:pt-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto flex max-w-5xl items-center justify-between px-3 sm:px-4">
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/25 sm:text-sm">
            <ChevronLeft className="h-3.5 w-3.5" /> Kembali
          </button>
          <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wide text-white uppercase backdrop-blur-sm sm:px-4 sm:py-1.5 sm:text-sm">
            {courts[selCourt - 1]?.name || `Lapangan ${selCourt}`}
          </span>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm sm:px-3 sm:py-1 sm:text-xs">SELESAI</span>
            ) : isLive ? (
              <span className="flex items-center gap-1 rounded-full bg-green-400/30 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm sm:px-3 sm:py-1 sm:text-xs">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-300 sm:h-2 sm:w-2" />
                LIVE
              </span>
            ) : <span className="text-[10px] text-white/50 sm:text-xs">—</span>}
            <span className="font-mono text-[10px] tabular-nums text-white/60 sm:text-xs">{currentTime}</span>
          </div>
        </div>
      </div>

      <div className="relative mx-auto flex h-[calc(100vh-52px)] w-full max-w-5xl flex-col overflow-hidden p-2 sm:h-[calc(100vh-60px)] sm:p-3 md:p-4 lg:p-6">
        <div className="flex flex-1 flex-col justify-start overflow-hidden">
          <div className="mx-auto w-full rounded-2xl bg-white shadow-md ring-1 ring-gray-100 p-3 sm:p-4 md:p-5 lg:p-6">
            {currentMatch ? (
              <>
                <p className="mb-1 mt-0.5 text-center text-[10px] tracking-wide text-gray-400 sm:mb-2 sm:mt-1 sm:text-xs md:mb-3 md:mt-1.5 md:text-sm">
                  Round {currentMatch.round} · {modeLabel(currentMatch.notes || "1-30")}
                </p>

                {isCompleted && (
                  <div className="mb-1 rounded-xl bg-gray-50 px-4 py-1.5 text-center text-xs font-semibold text-gray-500 ring-1 ring-gray-200 sm:mb-2 sm:text-sm md:mb-3 md:text-base">
                    ✓ Pertandingan Selesai
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500 shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl md:h-16 md:w-16 lg:h-20 lg:w-20">
                    <ShuttlecockIcon size={24} className="text-white sm:size-7 md:size-9 lg:size-11" />
                  </div>
                  <div className="basis-1/4 shrink-0 min-w-0 text-left">
                    <p className="truncate text-xs font-bold leading-tight text-gray-900 sm:text-sm md:text-base lg:text-lg xl:text-xl">{getName(currentMatch.team1Player1Id)}</p>
                    <p className="truncate text-xs font-bold leading-tight text-gray-900 sm:text-sm md:text-base lg:text-lg xl:text-xl">{getName(currentMatch.team1Player2Id)}</p>
                  </div>
                  <div className="flex flex-1 items-center justify-end">
                    <div className="flex w-full items-center justify-center rounded-xl bg-white px-3 py-1 shadow-md ring-1 ring-gray-100 sm:rounded-2xl sm:px-4 sm:py-1 md:px-5 md:py-1.5 lg:px-6 lg:py-1.5">
                      {(currentMatch.notes || "1-30").startsWith("2-21") ? (
                        <div className="flex items-center gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                          <div className="text-center">
                            <div className="text-7xl font-black text-gray-900 tabular-nums sm:text-8xl md:text-9xl lg:text-9xl tracking-wide" style={{ fontFamily: "var(--font-score), sans-serif" }}>{currentMatch.scoreTeam1 || 0}</div>
                            <p className="text-[8px] font-medium text-gray-400 uppercase sm:text-[10px] md:text-xs">Game 1</p>
                          </div>
                          <div className="h-10 w-px bg-gray-200 sm:h-12 md:h-14 lg:h-16" />
                          <div className="text-center">
                            <div className="text-7xl font-black text-gray-900 tabular-nums sm:text-8xl md:text-9xl lg:text-9xl tracking-wide" style={{ fontFamily: "var(--font-score), sans-serif" }}>{currentMatch.scoreTeam1Game2 || 0}</div>
                            <p className="text-[8px] font-medium text-gray-400 uppercase sm:text-[10px] md:text-xs">Game 2</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-7xl font-black text-gray-900 tabular-nums sm:text-8xl md:text-9xl lg:text-9xl tracking-wide" style={{ fontFamily: "var(--font-score), sans-serif" }}>{currentMatch.scoreTeam1 || 0}</div>
                      )}
                    </div>
                    <div className="h-12 w-2 rounded-r-lg bg-green-500 sm:h-14 sm:w-2.5 md:h-16 md:w-3 lg:h-20 lg:w-3.5" />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 py-1 sm:gap-2 sm:py-1.5 md:gap-3 md:py-2 lg:py-3">
                  <div className="flex-1 border-t border-dashed border-gray-300" />
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold tracking-wider text-gray-500 sm:h-6 sm:w-6 sm:text-[10px] md:h-8 md:w-8 md:text-xs lg:h-10 lg:w-10 lg:text-sm">VS</div>
                  <div className="flex-1 border-t border-dashed border-gray-300" />
                </div>

                <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl md:h-16 md:w-16 lg:h-20 lg:w-20">
                    <ShuttlecockIcon size={24} className="text-white sm:size-7 md:size-9 lg:size-11" />
                  </div>
                  <div className="basis-1/4 shrink-0 min-w-0 text-left">
                    <p className="truncate text-xs font-bold leading-tight text-gray-900 sm:text-sm md:text-base lg:text-lg xl:text-xl">{getName(currentMatch.team2Player1Id)}</p>
                    <p className="truncate text-xs font-bold leading-tight text-gray-900 sm:text-sm md:text-base lg:text-lg xl:text-xl">{getName(currentMatch.team2Player2Id)}</p>
                  </div>
                  <div className="flex flex-1 items-center justify-end">
                    <div className="flex w-full items-center justify-center rounded-xl bg-white px-3 py-1 shadow-md ring-1 ring-gray-100 sm:rounded-2xl sm:px-4 sm:py-1 md:px-5 md:py-1.5 lg:px-6 lg:py-1.5">
                      {(currentMatch.notes || "1-30").startsWith("2-21") ? (
                        <div className="flex items-center gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                          <div className="text-center">
                            <div className="text-7xl font-black text-gray-900 tabular-nums sm:text-8xl md:text-9xl lg:text-9xl tracking-wide" style={{ fontFamily: "var(--font-score), sans-serif" }}>{currentMatch.scoreTeam2 || 0}</div>
                            <p className="text-[8px] font-medium text-gray-400 uppercase sm:text-[10px] md:text-xs">Game 1</p>
                          </div>
                          <div className="h-10 w-px bg-gray-200 sm:h-12 md:h-14 lg:h-16" />
                          <div className="text-center">
                            <div className="text-7xl font-black text-gray-900 tabular-nums sm:text-8xl md:text-9xl lg:text-9xl tracking-wide" style={{ fontFamily: "var(--font-score), sans-serif" }}>{currentMatch.scoreTeam2Game2 || 0}</div>
                            <p className="text-[8px] font-medium text-gray-400 uppercase sm:text-[10px] md:text-xs">Game 2</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-7xl font-black text-gray-900 tabular-nums sm:text-8xl md:text-9xl lg:text-9xl tracking-wide" style={{ fontFamily: "var(--font-score), sans-serif" }}>{currentMatch.scoreTeam2 || 0}</div>
                      )}
                    </div>
                    <div className="h-12 w-2 rounded-r-lg bg-blue-500 sm:h-14 sm:w-2.5 md:h-16 md:w-3 lg:h-20 lg:w-3.5" />
                  </div>
                </div>

                <div className="mx-auto mt-1 flex items-center justify-center gap-2 self-center rounded-xl bg-white px-3 py-1.5 shadow-md ring-1 ring-gray-100 sm:mt-2 sm:gap-3 sm:px-5 sm:py-2 md:mt-3 md:gap-6 md:rounded-2xl md:px-6 md:py-2.5 lg:mt-4 lg:gap-8 lg:px-8 lg:py-3">
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 sm:gap-1.5 sm:text-xs md:gap-2 md:text-sm lg:gap-2.5 lg:text-base">
                    <Clock className="h-3 w-3 text-[#0d9488] sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" />
                    <span>Durasi <strong className="font-bold text-gray-700">{fmtDuration(elapsed)}</strong></span>
                  </div>
                  <div className="h-4 w-px bg-gray-200 sm:h-5 md:h-6" />
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 sm:gap-1.5 sm:text-xs md:gap-2 md:text-sm lg:gap-2.5 lg:text-base">
                    <Trophy className="h-3 w-3 text-amber-500 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" />
                    <span>{gameLabel(currentMatch.notes || "1-30")}</span>
                  </div>
                </div>
              </>
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
