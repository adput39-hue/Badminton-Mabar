"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { Swords, Plus, X, ChevronLeft, Play, Trophy, Clock, Radio, Timer, Star } from "lucide-react";
import CourtIcon from "@/components/court-icon";

const courtColors = [
  { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", badge: "bg-green-100 text-green-700", badgeIcon: "text-green-500", liveBadge: "bg-green-500 text-white" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", badge: "bg-blue-100 text-blue-700", badgeIcon: "text-blue-500", liveBadge: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600", badge: "bg-purple-100 text-purple-700", badgeIcon: "text-purple-500", liveBadge: "bg-purple-500 text-white" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", badge: "bg-amber-100 text-amber-700", badgeIcon: "text-amber-500", liveBadge: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-600", badge: "bg-rose-100 text-rose-700", badgeIcon: "text-rose-500", liveBadge: "bg-rose-500 text-white" },
];

export default function SparingMatchPage() {
  const { items: schedules } = useApi<ApiSchedule>("schedules");
  const { items: members } = useApi<ApiMember>("members");
  const { items: matches, refresh: refreshMatches, update: updateMatch } = useApi<ApiMatch>("matches");

  const [selSparingId, setSelSparingId] = useState<string | null>(null);
  const [selCourt, setSelCourt] = useState<number | null>(null);
  const [selRound, setSelRound] = useState(1);
  const [selAssignMatch, setSelAssignMatch] = useState("");
  const [activeMatch, setActiveMatch] = useState<ApiMatch | null>(null);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
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

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (!selSparingId) return;
    const es = new EventSource("/api/matches/stream");
    es.onmessage = (e) => {
      try {
        if (e.data === "connected") return;
        const d = JSON.parse(e.data);
        if (d.type?.startsWith("match-")) refreshMatches();
      } catch {}
    };
    es.onerror = () => {};
    const poll = setInterval(refreshMatches, 2000);
    return () => { es.close(); clearInterval(poll); };
  }, [selSparingId, refreshMatches]);

  // Track current view for browser back button
  const viewRef = useRef({ selSparingId, selCourt, activeMatch });
  useEffect(() => { viewRef.current = { selSparingId, selCourt, activeMatch }; });

  useEffect(() => {
    const handlePop = () => {
      const v = viewRef.current;
      if (v.activeMatch) { setActiveMatch(null); return; }
      if (v.selCourt !== null) { setSelCourt(null); return; }
      if (v.selSparingId) { setSelSparingId(null); return; }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  function fmtDuration(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  useEffect(() => {
    if (!activeMatch) { setStartedAt(null); return; }
    if ((activeMatch.scoreTeam1 || 0) + (activeMatch.scoreTeam2 || 0) > 0) {
      setStartedAt((prev) => prev || Date.now());
    }
  }, [activeMatch]);

  const sparings = useMemo(() =>
    schedules.filter((s) => s.sparingOpponent).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [schedules]);

  const selectedSparing = sparings.find((s) => s.id === selSparingId);

  const savedSettings = useMemo(() => {
    if (!selectedSparing?.notes) return null;
    try { return JSON.parse(selectedSparing.notes); } catch { return null; }
  }, [selectedSparing]);

  const courts: { name: string; startTime: string; endTime: string }[] = savedSettings?.courts || [];
  const modeLabel = savedSettings?.draftGames || "1-30";
  const totalRounds = savedSettings?.totalRounds || 1;

  const sparingMatches = useMemo(() =>
    matches.filter((m) => m.scheduleId === selSparingId),
  [matches, selSparingId]);

  const courtMatches = useMemo(() =>
    selCourt !== null ? sparingMatches.filter((m) => m.courtNumber === selCourt && m.round === selRound) : [],
  [sparingMatches, selCourt, selRound]);

  const unassignedMatches = useMemo(() =>
    sparingMatches.filter((m) => !m.courtNumber && m.round === selRound),
  [sparingMatches, selRound]);

  const roundMatches = useMemo(() =>
    selCourt !== null ? sparingMatches.filter((m) => m.courtNumber === selCourt) : [],
  [sparingMatches, selCourt]);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  async function assignMatch(matchId: string, courtNum: number) {
    await updateMatch(matchId, { courtNumber: courtNum });
  }

  async function addScore(team: 1 | 2) {
    if (!activeMatch) return;
    if (!startedAt) setStartedAt(Date.now());
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const isTwoGame = modeLabel.startsWith("2-21");

    if (isTwoGame) {
      const g2s1 = activeMatch.scoreTeam1Game2 || 0;
      const g2s2 = activeMatch.scoreTeam2Game2 || 0;
      const g1Done = s1 >= 21 || s2 >= 21;

      if (!g1Done) {
        const ns1 = team === 1 ? s1 + 1 : s1;
        const ns2 = team === 2 ? s2 + 1 : s2;
        const next = { ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2 };
        await updateMatch(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2 });
        setActiveMatch(next);
        if (ns1 >= 21 || ns2 >= 21) {
          setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2 });
        }
      } else {
        const ns1 = team === 1 ? g2s1 + 1 : g2s1;
        const ns2 = team === 2 ? g2s2 + 1 : g2s2;
        const next = { ...activeMatch, scoreTeam1Game2: ns1, scoreTeam2Game2: ns2 };
        await updateMatch(activeMatch.id, { scoreTeam1Game2: ns1, scoreTeam2Game2: ns2 });
        setActiveMatch(next);
        if (ns1 >= 21 || ns2 >= 21) {
          await updateMatch(activeMatch.id, { status: "completed", winnerTeam: ns1 > ns2 ? 1 : 2 });
          setActiveMatch(null);
        }
      }
    } else {
      const maxScore = modeLabel === "1-42" ? 42 : 30;
      const ns1 = team === 1 ? s1 + 1 : s1;
      const ns2 = team === 2 ? s2 + 1 : s2;
      await updateMatch(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2 });
      setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2 });
      if (ns1 >= maxScore || ns2 >= maxScore) {
        await updateMatch(activeMatch.id, { status: "completed", winnerTeam: ns1 > ns2 ? 1 : 2 });
        setActiveMatch(null);
      }
    }
  }

  async function subtractScore(team: 1 | 2) {
    if (!activeMatch) return;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const isTwoGame = modeLabel.startsWith("2-21");

    if (isTwoGame) {
      const g2s1 = activeMatch.scoreTeam1Game2 || 0;
      const g2s2 = activeMatch.scoreTeam2Game2 || 0;
      const g1Done = s1 >= 21 || s2 >= 21;

      if (!g1Done) {
        const ns1 = team === 1 ? Math.max(0, s1 - 1) : s1;
        const ns2 = team === 2 ? Math.max(0, s2 - 1) : s2;
        await updateMatch(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2 });
        setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2 });
      } else {
        const ns1 = team === 1 ? Math.max(0, g2s1 - 1) : g2s1;
        const ns2 = team === 2 ? Math.max(0, g2s2 - 1) : g2s2;
        await updateMatch(activeMatch.id, { scoreTeam1Game2: ns1, scoreTeam2Game2: ns2 });
        setActiveMatch({ ...activeMatch, scoreTeam1Game2: ns1, scoreTeam2Game2: ns2 });
      }
    } else {
      const ns1 = team === 1 ? Math.max(0, s1 - 1) : s1;
      const ns2 = team === 2 ? Math.max(0, s2 - 1) : s2;
      await updateMatch(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2 });
      setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2 });
    }
  }

  async function swapTeams() {
    if (!activeMatch) return;
    const s = activeMatch;
    await updateMatch(s.id, {
      team1Player1Id: s.team2Player1Id, team1Player2Id: s.team2Player2Id,
      team2Player1Id: s.team1Player1Id, team2Player2Id: s.team1Player2Id,
      scoreTeam1: s.scoreTeam2, scoreTeam2: s.scoreTeam1,
      scoreTeam1Game2: s.scoreTeam2Game2, scoreTeam2Game2: s.scoreTeam1Game2,
    });
    setActiveMatch({
      ...s,
      team1Player1Id: s.team2Player1Id, team1Player2Id: s.team2Player2Id,
      team2Player1Id: s.team1Player1Id, team2Player2Id: s.team1Player2Id,
      scoreTeam1: s.scoreTeam2, scoreTeam2: s.scoreTeam1,
      scoreTeam1Game2: s.scoreTeam2Game2, scoreTeam2Game2: s.scoreTeam1Game2,
    });
  }

  async function finishMatch() {
    if (!activeMatch) return;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const isTwoGame = modeLabel.startsWith("2-21");
    let winner = 1;
    if (isTwoGame) {
      const g2s1 = activeMatch.scoreTeam1Game2 || 0;
      const g2s2 = activeMatch.scoreTeam2Game2 || 0;
      const g1Done = s1 >= 21 || s2 >= 21;
      if (g1Done) {
        winner = g2s1 > g2s2 ? 1 : g2s2 > g2s1 ? 2 : 1;
      } else {
        winner = s1 > s2 ? 1 : s2 > s1 ? 2 : 1;
      }
    } else {
      winner = s1 > s2 ? 1 : s2 > s1 ? 2 : 1;
    }
    await updateMatch(activeMatch.id, { status: "completed", winnerTeam: winner });
    setShowConfirmFinish(false);
    setActiveMatch(null);
  }

  // --- VIEW 1: Pilih Sparing ---
  if (!selSparingId) {
    return (
      <div className="relative min-h-screen bg-[#f0fdfa]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25"><ChevronLeft className="h-4 w-4" /> Kembali</Link>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Controler</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Pilih sparing untuk mulai mengontrol pertandingan</p>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {sparings.map((s, i) => {
              const cMatches = matches.filter((m) => m.scheduleId === s.id);
              const hasLive = cMatches.some((m) => m.status !== "completed" && m.courtNumber);
              const color = courtColors[i % courtColors.length];
              return (
                <button key={s.id} onClick={() => { history.pushState(null, ""); setSelSparingId(s.id); }}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488] sm:p-5">
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
                      <h3 className="text-sm font-bold text-gray-900 sm:text-base">{pbName || "Sparing"} vs {s.sparingOpponent}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">{new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                      {hasLive ? (
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${color.liveBadge}`}>
                          <Radio className="h-2.5 w-2.5" /> LIVE
                        </span>
                      ) : (
                        <span className="mt-2 text-xs text-gray-400">{cMatches.length} pertandingan</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {sparings.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center py-10">Belum ada sparing</p>}
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 2: Layar Skor Aktif ---
  if (activeMatch) {
    const isTwoGame = modeLabel.startsWith("2-21");
    const maxScore = modeLabel === "1-42" ? 42 : 30;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const g2s1 = activeMatch.scoreTeam1Game2 || 0;
    const g2s2 = activeMatch.scoreTeam2Game2 || 0;
    const g1Done = isTwoGame && (s1 >= 21 || s2 >= 21);
    const ci = (activeMatch.courtNumber || 1) - 1;
    const color = courtColors[ci % courtColors.length];

    return (
      <div className="relative min-h-screen bg-[#f0fdfa]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-4 pt-4">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto flex max-w-lg items-center justify-between px-4">
            <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25">
              <ChevronLeft className="h-4 w-4" /> Kembali
            </button>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">L{activeMatch.courtNumber}</span>
              <span className="text-white/40">·</span>
              <span>R{activeMatch.round}</span>
            </div>
          </div>
        </div>
        <div className="relative flex min-h-[calc(100vh-64px)] items-start justify-center p-4 pt-6">
          <div className="w-full max-w-md sm:max-w-lg">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 text-right pr-4">
                  <p className="text-lg font-bold text-gray-900 leading-tight">{getName(activeMatch.team1Player1Id)}</p>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{getName(activeMatch.team1Player2Id)}</p>
                </div>
                <div className={`text-5xl font-bold tabular-nums ${color.text}`}>
                  {isTwoGame ? (g1Done ? g2s1 : s1) : s1}
                </div>
                <div className="flex flex-col items-center gap-1 px-3">
                  <span className="text-xs text-gray-300 font-bold">VS</span>
                  <button onClick={swapTeams} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Tukar posisi tim">⇄</button>
                </div>
                <div className={`text-5xl font-bold tabular-nums ${color.text}`}>
                  {isTwoGame ? (g1Done ? g2s2 : s2) : s2}
                </div>
                <div className="flex-1 text-left pl-4">
                  <p className="text-lg font-bold text-gray-900 leading-tight">{getName(activeMatch.team2Player1Id)}</p>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{getName(activeMatch.team2Player2Id)}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mb-6">
                {isTwoGame && !g1Done && <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${color.badge}`}>Game 1</span>}
                {isTwoGame && g1Done && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Game 2</span>}
                {!isTwoGame && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">1 Game {modeLabel === "1-42" ? "42" : "30"}</span>}
                {startedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    <Clock className="h-3 w-3" /> {fmtDuration(Math.floor((now - startedAt) / 1000))}
                  </span>
                )}
              </div>

              <div className="flex justify-center gap-6">
                <div className="flex flex-col items-center gap-3">
                  <button onClick={() => addScore(1)} className={`flex h-20 w-20 items-center justify-center rounded-2xl ${color.bg} text-4xl font-bold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all`}>+</button>
                  <button onClick={() => subtractScore(1)} className="flex h-12 w-20 items-center justify-center rounded-xl border-2 border-gray-200 text-xl font-bold text-gray-500 shadow-sm hover:border-red-300 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all">-</button>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button onClick={() => addScore(2)} className={`flex h-20 w-20 items-center justify-center rounded-2xl ${color.bg} text-4xl font-bold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all`}>+</button>
                  <button onClick={() => subtractScore(2)} className="flex h-12 w-20 items-center justify-center rounded-xl border-2 border-gray-200 text-xl font-bold text-gray-500 shadow-sm hover:border-red-300 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all">-</button>
                </div>
              </div>

              <div className="mt-6">
                <button onClick={() => setShowConfirmFinish(true)} className={`w-full rounded-xl ${color.bg} px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110`}>Selesaikan Pertandingan</button>
              </div>
            </div>

            {showConfirmFinish && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm" onClick={() => setShowConfirmFinish(false)}>
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Selesaikan Pertandingan?</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Skor saat ini: {s1} - {s2}{isTwoGame && g1Done ? ` (Game 2: ${g2s1} - ${g2s2})` : ""}
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowConfirmFinish(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                    <button onClick={finishMatch} className="rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e]">Yakin, Selesai</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 3: Belum Assign ---
  if (selCourt !== null && selCourt === 0) {
    return (
      <div className="relative min-h-screen bg-[#f0fdfa]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <button onClick={() => window.history.back()} className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25"><ChevronLeft className="h-4 w-4" /> Kembali</button>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Belum Assign</h1>
            <p className="mt-1 text-sm font-medium text-white/70">{unassignedMatches.length} pertandingan belum memiliki lapangan</p>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          {unassignedMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm">
              <Play className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">Semua pertandingan sudah di-assign</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unassignedMatches.map((m, i) => {
                const color = courtColors[i % courtColors.length];
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-2xl border border-dashed border-gray-300 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.bg}`}>
                        <CourtIcon size={22} color="white" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-gray-800">{getName(m.team1Player1Id)} & {getName(m.team1Player2Id)}</p>
                        <p className="text-xs text-gray-400">vs {getName(m.team2Player1Id)} & {getName(m.team2Player2Id)}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">R{m.round}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VIEW 4: Detail Lapangan + Assign ---
  if (selCourt !== null) {
    const color = courtColors[(selCourt - 1) % courtColors.length];
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
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm sm:h-14 sm:w-14`}>
                <CourtIcon size={28} color="white" className="sm:size-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white sm:text-2xl">{courts[selCourt - 1]?.name || `Lapangan ${selCourt}`}</h1>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                  {courts[selCourt - 1] && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {courts[selCourt - 1].startTime.slice(0,5)} - {courts[selCourt - 1].endTime.slice(0,5)}
                    </span>
                  )}
                  <span className="text-white/30">·</span>
                  <span>{courtMatches.filter((m) => m.round === selRound).length} pertandingan</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-4 flex items-center gap-2">
            <select value={selRound} onChange={(e) => setSelRound(Number(e.target.value))}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                <option key={r} value={r}>Round {r}</option>
              ))}
            </select>
            <span className="rounded-full bg-[#0d9488]/10 px-3 py-1 text-xs font-medium text-[#0d9488]">Round {selRound}</span>
          </div>

          {unassignedMatches.length > 0 && (
            <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Assign Pertandingan</h3>
              <select value={selAssignMatch} onChange={async (e) => { const v = e.target.value; if (v) { await assignMatch(v, selCourt); setSelAssignMatch(""); } }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                <option value="" disabled>Pilih pertandingan...</option>
                {unassignedMatches.map((m) => (
                  <option key={m.id} value={m.id}>R{m.round} — {getName(m.team1Player1Id)} + {getName(m.team1Player2Id)} vs {getName(m.team2Player1Id)} + {getName(m.team2Player2Id)}</option>
                ))}
              </select>
            </div>
          )}

          {courtMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm">
              <Play className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">Belum ada pertandingan</p>
              <p className="text-xs text-gray-400">Pilih pertandingan dari dropdown di atas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {courtMatches.map((m, i) => {
                const isCompleted = m.status === "completed";
                const matchColor = courtColors[(selCourt - 1 + i) % courtColors.length];
                return (
                  <div key={m.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${isCompleted ? "border-gray-200" : "border-gray-200 hover:shadow-md"} ${!isCompleted ? "cursor-pointer hover:border-[#0d9488]" : ""}`}
                    onClick={() => { if (isCompleted) return; history.pushState(null, ""); setActiveMatch(m); }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${matchColor.bg}`}>
                          <CourtIcon size={18} color="white" />
                        </div>
                        <span className="text-xs text-gray-400">Round {m.round}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-600">
                            <Trophy className="h-3 w-3" /> Selesai
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${matchColor.liveBadge}`}>
                            <Radio className="h-2.5 w-2.5" /> LIVE
                          </span>
                        )}
                        <button onClick={async (e) => { e.stopPropagation(); try { await updateMatch(m.id, { courtNumber: null, ...(m.status !== "completed" ? { status: "scheduled", scoreTeam1: 0, scoreTeam2: 0, scoreTeam1Game2: 0, scoreTeam2Game2: 0 } : {}) }); } catch (ex) { console.error(ex); } }}
                          className="rounded-lg border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200" title="Lepas dari lapangan">Lepas</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-right">
                        <p className="font-bold text-gray-900">{getName(m.team1Player1Id)} <span className="text-gray-400 font-normal">-</span> {getName(m.team1Player2Id)}</p>
                        {isCompleted && <p className="text-lg font-bold mt-1" style={{ color: m.winnerTeam === 1 ? "#0d9488" : "#6b7280" }}>{m.scoreTeam1}{m.totalGames > 1 && `, ${m.scoreTeam1Game2}`}</p>}
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-gray-300 font-bold">VS</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-gray-900">{getName(m.team2Player1Id)} <span className="text-gray-400 font-normal">-</span> {getName(m.team2Player2Id)}</p>
                        {isCompleted && <p className="text-lg font-bold mt-1" style={{ color: m.winnerTeam === 2 ? "#0d9488" : "#6b7280" }}>{m.scoreTeam2}{m.totalGames > 1 && `, ${m.scoreTeam2Game2}`}</p>}
                      </div>
                    </div>
                    {!isCompleted && (
                      <div className="mt-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-xl ${matchColor.bg} px-4 py-1.5 text-xs font-semibold text-white shadow-sm`}>
                          <Play className="h-3 w-3" /> Mulai / Input Skor
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VIEW 5: Grid Lapangan ---
  return (
    <div className="relative min-h-screen bg-[#f0fdfa]">
      {/* Header gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9488] to-[#0f766e] pb-6 pt-4 sm:pb-8 sm:pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <button onClick={() => window.history.back()} className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25">
            <ChevronLeft className="h-4 w-4" /> Kembali
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-white sm:text-2xl">Control Match</h1>
              <p className="mt-1 text-sm font-medium text-white/80">
                {selectedSparing?.sparingOpponent 
                  ? `${pbName || "Sparing"} vs ${selectedSparing.sparingOpponent}`
                  : "Pilih sparing"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-medium backdrop-blur-sm">
                  {modeLabel.includes("2-21") ? "2 Game 21" : modeLabel.includes("42") ? "1 Game 42" : "1 Game 30"}
                </span>
                {savedSettings?.lokasi && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-medium backdrop-blur-sm">
                    {savedSettings.lokasi}
                  </span>
                )}
              </div>
            </div>
            {unassignedMatches.length > 0 && (
              <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm">
                {unassignedMatches.length} belum assign
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {courts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm">
            <Swords className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Belum ada lapangan</p>
            <p className="text-xs text-gray-400">Atur lapangan di menu Sparing → Pengaturan</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {courts.map((court, i) => {
              const cMatches = sparingMatches.filter((m) => m.courtNumber === i + 1);
              const completed = cMatches.filter((m) => m.status === "completed").length;
              const hasLive = cMatches.some((m) => m.status !== "completed");
              const color = courtColors[i % courtColors.length];
              return (
                <button key={i} onClick={() => { history.pushState(null, ""); setSelCourt(i + 1); }}
                  className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md sm:p-5 ${hasLive ? `${color.border} border-2` : "border-gray-200 hover:border-[#0d9488]"}`}>
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
                      ) : completed > 0 ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-600">SELESAI</span>
                      ) : (
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${color.badge}`}>
                          <Timer className={`h-2.5 w-2.5 ${color.badgeIcon}`} /> Belum Dimulai
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`mt-3 flex items-center justify-between border-t border-gray-100 pt-3 sm:mt-4 ${hasLive ? color.text : "text-gray-500"}`}>
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Swords className={`h-3.5 w-3.5 ${hasLive ? "" : "text-gray-400"}`} />
                      {cMatches.length} pertandingan
                    </div>
                    {completed > 0 && (
                      <span className={`rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium ${hasLive ? "text-gray-700" : "text-gray-500"}`}>{completed}/{cMatches.length} selesai</span>
                    )}
                  </div>
                </button>
              );
            })}
            {unassignedMatches.length > 0 && (
              <button onClick={() => { history.pushState(null, ""); setSelCourt(0); }}
                className="group relative overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488] sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-200 sm:h-14 sm:w-14">
                    <CourtIcon size={28} color="#9ca3af" className="sm:size-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-500 sm:text-base">Belum Assign</h3>
                    <p className="mt-0.5 text-xs text-gray-400">Pertandingan tanpa lapangan</p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">{unassignedMatches.length} pertandingan</span>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}