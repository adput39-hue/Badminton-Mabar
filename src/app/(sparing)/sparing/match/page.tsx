"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useControlData } from "@/lib/api-store";
import { writeLiveScore, readLiveScore } from "@/lib/firebase";
import { useWakeLock } from "@/lib/use-wake-lock";
import type { ApiMatch, ApiSchedule, ApiMember, ApiTournament, ApiTeam } from "@/lib/api-types";
import { createPortal } from "react-dom";
import { Swords, Plus, X, ChevronLeft, Play, Trophy, Clock, Radio, Timer, Star, Loader2, ImageIcon } from "lucide-react";
import CourtIcon from "@/components/court-icon";
import { LoadingSpinner } from "@/components/loading-spinner";
import { MatchCardModal } from "@/components/match-card-modal";

const courtColors = [
  { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", badge: "bg-green-100 text-green-700", badgeIcon: "text-green-500", liveBadge: "bg-green-500 text-white" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", badge: "bg-blue-100 text-blue-700", badgeIcon: "text-blue-500", liveBadge: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600", badge: "bg-purple-100 text-purple-700", badgeIcon: "text-purple-500", liveBadge: "bg-purple-500 text-white" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", badge: "bg-amber-100 text-amber-700", badgeIcon: "text-amber-500", liveBadge: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-600", badge: "bg-rose-100 text-rose-700", badgeIcon: "text-rose-500", liveBadge: "bg-rose-500 text-white" },
];

export default function SparingMatchPage() {
  useWakeLock();
  const { schedules, members, matches: controlMatches, tournaments, teams, loaded, refresh: refreshControl } = useControlData();
  const schedulesLoaded = loaded, membersLoaded = loaded, matchesLoaded = loaded;
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  useEffect(() => { setMatches(controlMatches); }, [controlMatches]);
  async function updateMatch(id: string, data: Record<string, unknown>) {
    const pbId = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
    const res = await fetch(`/api/matches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-pb-id": pbId },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => "API error"));
    const updated = await res.json() as ApiMatch;
    setMatches((prev) => prev.map((m) => m.id === id ? updated : m));
    return updated;
  }

  const [selSparingId, setSelSparingId] = useState<string | null>(null);
  const [selTournamentId, setSelTournamentId] = useState<string | null>(null);
  const [selMabarId, setSelMabarId] = useState<string | null>(null);
  const [selCourt, setSelCourt] = useState<number | null>(null);
  const [selRound, setSelRound] = useState(1);
  const [selAssignMatch, setSelAssignMatch] = useState("");
  const [activeMatch, setActiveMatch] = useState<ApiMatch | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [finishAsDraw, setFinishAsDraw] = useState(false);
  const [showConfirmGame3, setShowConfirmGame3] = useState(false);
  const [showCompletedPopup, setShowCompletedPopup] = useState(false);
  const [completedSparingName, setCompletedSparingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [cockCount, setCockCount] = useState("1");
  const [curGame, setCurGame] = useState<1 | 2 | 3>(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pbName, setPbName] = useState("");
  const [pbColor, setPbColor] = useState<string | null>(null);
  const [cardMatch, setCardMatch] = useState<ApiMatch | null>(null);
  const [firstDataLoaded, setFirstDataLoaded] = useState(false);
  useEffect(() => {
    if (schedulesLoaded && membersLoaded && matchesLoaded) setFirstDataLoaded(true);
  }, [schedulesLoaded, membersLoaded, matchesLoaded]);

  useEffect(() => {
    try {
      const tid = new URLSearchParams(window.location.search).get("tournamentId");
      if (tid) setSelTournamentId(tid);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.pb?.name) setPbName(u.pb.name);
        if (u.pb?.primaryColor) setPbColor(u.pb.primaryColor);
      }
    } catch {}
  }, []);

  // restore startedAt after refresh if match already started
  useEffect(() => {
    if (!activeMatch) { setStartedAt(null); return; }
    if (activeMatch.scoreTeam1 !== null || activeMatch.scoreTeam2 !== null) {
      setStartedAt(new Date(activeMatch.updatedAt).getTime());
      if (activeMatch.notes) {
        try {
          const n = JSON.parse(activeMatch.notes);
          if (n.startedAt) startedAtRef.current = n.startedAt;
        } catch {}
      }
      if (!startedAtRef.current) startedAtRef.current = activeMatch.updatedAt;
    } else {
      const now = Date.now();
      setStartedAt(now);
      const startIso = new Date(now).toISOString();
      startedAtRef.current = startIso;
      saveToSupabase(activeMatch.id, { scoreTeam1: 0, scoreTeam2: 0, notes: getTimeNotes({ startedAt: startIso }) });
      writeLiveScore(activeMatch.id, { scoreTeam1: 0, scoreTeam2: 0, courtNumber: activeMatch.courtNumber ?? null });
    }
  }, [activeMatch?.id]);

  // Reset ke Game 1 / buka Game berikutnya saat membuka match
  useEffect(() => {
    if (!activeMatch) return;
    let game1Finished = false;
    let game2Finished = false;
    if (activeMatch.notes) {
      try {
        const n = JSON.parse(activeMatch.notes);
        game1Finished = n.game1Finished === true;
        game2Finished = n.game2Finished === true;
      } catch {}
    }
    if (activeMatch.totalGames > 1) {
      if ((activeMatch.scoreTeam1Game3 || 0) > 0 || (activeMatch.scoreTeam2Game3 || 0) > 0 || game2Finished) {
        setCurGame(3);
      } else if ((activeMatch.scoreTeam1Game2 || 0) > 0 || (activeMatch.scoreTeam2Game2 || 0) > 0 || game1Finished) {
        setCurGame(2);
      } else {
        setCurGame(1);
      }
    } else {
      setCurGame(1);
    }
  }, [activeMatch?.id, activeMatch?.totalGames]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Track current view for browser back button
  const viewRef = useRef({ selSparingId, selTournamentId, selMabarId, selCourt, activeMatch });
  useEffect(() => { viewRef.current = { selSparingId, selTournamentId, selMabarId, selCourt, activeMatch }; });

  useEffect(() => {
    const handlePop = () => {
      const v = viewRef.current;
      if (v.activeMatch) { setActiveMatch(null); return; }
      if (v.selCourt !== null) { setSelCourt(null); return; }
      if (v.selSparingId) { setSelSparingId(null); return; }
      if (v.selTournamentId) { setSelTournamentId(null); return; }
      if (v.selMabarId) { setSelMabarId(null); return; }
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

  // Sparing schedules (sparingOpponent set)
  const sparings = useMemo(() =>
    schedules.filter((s) => s.sparingOpponent).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [schedules]);

  // Mabar schedules (no sparingOpponent, no tournamentId)
  const mabarSchedules = useMemo(() =>
    schedules.filter((s) => !s.sparingOpponent && !s.tournamentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [schedules]);

  // Tournament groupings
  const tournamentSchedIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of schedules) {
      if (s.tournamentId) {
        const arr = map.get(s.tournamentId) || [];
        arr.push(s.id);
        map.set(s.tournamentId, arr);
      }
    }
    return map;
  }, [schedules]);

  const tournamentSchedules = useMemo(() =>
    schedules.filter((s) => s.tournamentId),
  [schedules]);

  const selectedSparing = sparings.find((s) => s.id === selSparingId);
  const selectedTournament = tournaments.find((t) => t.id === selTournamentId);

  const savedSettings = useMemo(() => {
    if (!selectedSparing?.notes) return null;
    try { return JSON.parse(selectedSparing.notes); } catch { return null; }
  }, [selectedSparing]);

  const isTournamentMode = !!selTournamentId;
  const isMabarMode = !!selMabarId;
  const tournamentSchedIdsList = selTournamentId ? (tournamentSchedIds.get(selTournamentId) || []) : [];

  const selectedMabar = mabarSchedules.find((s) => s.id === selMabarId);
  const mabarSettings = useMemo(() => {
    if (!selectedMabar?.notes) return null;
    try { return JSON.parse(selectedMabar.notes); } catch { return null; }
  }, [selectedMabar]);

  const courts: { name: string; startTime: string; endTime: string }[] = isTournamentMode
    ? (selectedTournament?.courts ? JSON.parse(selectedTournament.courts).map((c: { name: string }) => ({ name: c.name, startTime: "", endTime: "" })) : [])
    : isMabarMode
      ? (mabarSettings?.courts || (selectedMabar?.courts ? JSON.parse(selectedMabar.courts).map((c: { name: string }) => ({ name: c.name, startTime: "", endTime: "" })) : []))
      : savedSettings?.courts || (selectedSparing?.courts ? JSON.parse(selectedSparing.courts).map((c: { name: string }) => ({ name: c.name, startTime: "", endTime: "" })) : []);

  const getMatchFormat = (m: ApiMatch | null): string => {
    if (!m?.notes) return "";
    try {
      const n = JSON.parse(m.notes);
      if (typeof n === "string") return n;
      if (n.text) return n.text;
      if (n.draftGames) return n.draftGames;
      if (n.gameMode) return n.gameMode;
    } catch {
      if (m.notes.startsWith("1-") || m.notes.startsWith("2-")) return m.notes.split(",")[0];
    }
    return "";
  };

  const formatLabels: Record<string, string> = { "1x30": "1-30", "1x42": "1-42", "2x21": "2-21" };
  const scheduleMode = isTournamentMode
    ? (formatLabels[selectedTournament?.gameFormat || "1x30"] || "1-30")
    : isMabarMode
      ? (mabarSettings?.gameMode || "1-30")
      : savedSettings?.draftGames || "1-30";
  const modeLabel = getMatchFormat(activeMatch) || scheduleMode;

  const totalRounds = isTournamentMode ? 1 : (isMabarMode ? 1 : savedSettings?.totalRounds || 1);

  const cardTitle = isTournamentMode
    ? selectedTournament?.name || "League"
    : isMabarMode
      ? selectedMabar?.title || "Mabar"
      : selectedSparing?.sparingOpponent
        ? `${pbName || "Sparing"} vs ${selectedSparing.sparingOpponent}`
        : "Sparing";

  const sparingMatches = useMemo(() => {
    if (isTournamentMode) return matches.filter((m) => tournamentSchedIdsList.includes(m.scheduleId));
    if (isMabarMode) return matches.filter((m) => m.scheduleId === selMabarId);
    return matches.filter((m) => m.scheduleId === selSparingId);
  }, [matches, selSparingId, isTournamentMode, tournamentSchedIdsList, isMabarMode, selMabarId]);

  const courtMatches = useMemo(() =>
    selCourt !== null ? sparingMatches.filter((m) => m.courtNumber === selCourt && (isMabarMode || m.round === selRound)) : [],
  [sparingMatches, selCourt, selRound, isMabarMode]);

  const unassignedMatches = useMemo(() =>
    sparingMatches.filter((m) => !m.courtNumber && (isMabarMode || m.round === selRound)),
  [sparingMatches, selRound, isMabarMode]);

  const roundMatches = useMemo(() =>
    selCourt !== null ? sparingMatches.filter((m) => m.courtNumber === selCourt) : [],
  [sparingMatches, selCourt]);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  const tournamentStandings = useMemo(() => {
    const tourney = tournaments.find((t) => t.id === selTournamentId);
    if (!selTournamentId || !tourney) return [];
    const teamList = tourney.teams || [];
    if (teamList.length === 0) return [];
    const mode = tourney.standingsMode || "points";
    const winPts = tourney.winPoints ?? 2;
    const drawPts = tourney.drawPoints ?? 1;
    const lossPts = tourney.lossPoints ?? 0;
    const scheds = schedules.filter((s) => s.tournamentId === selTournamentId && s.team1Id && s.team2Id) as (ApiSchedule & { team1Id: string; team2Id: string })[];
    const map = new Map<string, { team: ApiTeam; played: number; won: number; drawn: number; lost: number; points: number; score: number }>();
    for (const t of teamList) map.set(t.id, { team: t, played: 0, won: 0, drawn: 0, lost: 0, points: 0, score: 0 });
    for (const s of scheds) {
      const t1 = map.get(s.team1Id);
      const t2 = map.get(s.team2Id);
      if (!t1 || !t2) continue;
      for (const m of matches.filter((x) => x.scheduleId === s.id)) {
        const hasResult = m.winnerTeam != null || m.status === "completed";
        if (!hasResult) continue;
        t1.played++;
        t2.played++;
        if (m.winnerTeam === 1) { t1.won++; t2.lost++; t1.points += winPts; t2.points += lossPts; }
        else if (m.winnerTeam === 2) { t2.won++; t1.lost++; t2.points += winPts; t1.points += lossPts; }
        else { t1.drawn++; t2.drawn++; t1.points += drawPts; t2.points += drawPts; }
        t1.score += (m.scoreTeam1 || 0) + (m.scoreTeam1Game2 || 0) + (m.scoreTeam1Game3 || 0);
        t2.score += (m.scoreTeam2 || 0) + (m.scoreTeam2Game2 || 0) + (m.scoreTeam2Game3 || 0);
      }
    }
    const rows = [...map.values()];
    return mode === "score" ? rows.sort((a, b) => b.score - a.score || b.won - a.won) : rows.sort((a, b) => b.points - a.points || b.won - a.won);
  }, [selTournamentId, tournaments, schedules, matches]);


  function setMatchOptimistic(id: string, data: Record<string, unknown>) {
    writeLiveScore(id, {
      courtNumber: activeMatch?.courtNumber ?? null,
      ...data,
    } as { scoreTeam1?: number; scoreTeam2?: number; scoreTeam1Game2?: number; scoreTeam2Game2?: number; scoreTeam1Game3?: number; scoreTeam2Game3?: number; status?: string; winnerTeam?: number | null });
  }

  function saveToSupabase(id: string, data: Record<string, unknown>) {
    const pbId = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
    fetch(`/api/matches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-pb-id": pbId },
      body: JSON.stringify(data),
    });
  }

  function getTimeNotes(extra: Record<string, unknown>) {
    const existing = activeMatch?.notes;
    let obj: Record<string, unknown> = {};
    if (existing) {
      try { obj = JSON.parse(existing); } catch { obj = { text: existing }; }
    }
    if (startedAtRef.current && !extra.startedAt) obj.startedAt = startedAtRef.current;
    return JSON.stringify({ ...obj, ...extra });
  }

  async function assignMatch(matchId: string, courtNum: number) {
    await updateMatch(matchId, { courtNumber: courtNum });
  }

  function openMatchScore(m: ApiMatch) {
    history.pushState(null, "");
    setActiveMatch(m);
    setLoadingMatch(true);
    if (m.status === "completed") { setLoadingMatch(false); return; }
    readLiveScore(m.id).then((live) => {
      if (live) setActiveMatch((prev) => prev ? { ...prev, scoreTeam1: (live.scoreTeam1 as number) ?? prev.scoreTeam1, scoreTeam2: (live.scoreTeam2 as number) ?? prev.scoreTeam2, scoreTeam1Game2: (live.scoreTeam1Game2 as number) ?? prev.scoreTeam1Game2, scoreTeam2Game2: (live.scoreTeam2Game2 as number) ?? prev.scoreTeam2Game2, scoreTeam1Game3: (live.scoreTeam1Game3 as number) ?? prev.scoreTeam1Game3, scoreTeam2Game3: (live.scoreTeam2Game3 as number) ?? prev.scoreTeam2Game3, status: (live.status as string) || prev.status, winnerTeam: (live.winnerTeam as number) ?? prev.winnerTeam, courtNumber: (live.courtNumber as number) ?? prev.courtNumber } : null);
    }).catch(() => {}).finally(() => { setLoadingMatch(false); });
  }

  function addScore(team: 1 | 2) {
    if (!activeMatch) return;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const isTwoGame = modeLabel.startsWith("2-21");

    if (isTwoGame) {
      const g2s1 = activeMatch.scoreTeam1Game2 || 0;
      const g2s2 = activeMatch.scoreTeam2Game2 || 0;
      const g3s1 = activeMatch.scoreTeam1Game3 || 0;
      const g3s2 = activeMatch.scoreTeam2Game3 || 0;

      if (curGame === 1) {
        if (isGameWon(s1, s2)) return;
        const ns1 = team === 1 ? s1 + 1 : s1;
        const ns2 = team === 2 ? s2 + 1 : s2;
        setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2, lastScorer: team } as unknown as ApiMatch);
        setMatchOptimistic(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2, lastScorer: team });
      } else if (curGame === 2) {
        if (isGameWon(g2s1, g2s2)) return;
        const ns1 = team === 1 ? g2s1 + 1 : g2s1;
        const ns2 = team === 2 ? g2s2 + 1 : g2s2;
        setActiveMatch({ ...activeMatch, scoreTeam1Game2: ns1, scoreTeam2Game2: ns2, lastScorer: team } as unknown as ApiMatch);
        setMatchOptimistic(activeMatch.id, { scoreTeam1Game2: ns1, scoreTeam2Game2: ns2, lastScorer: team });
      } else {
        if (isGameWon(g3s1, g3s2)) return;
        const ns1 = team === 1 ? g3s1 + 1 : g3s1;
        const ns2 = team === 2 ? g3s2 + 1 : g3s2;
        setActiveMatch({ ...activeMatch, scoreTeam1Game3: ns1, scoreTeam2Game3: ns2, lastScorer: team } as unknown as ApiMatch);
        setMatchOptimistic(activeMatch.id, { scoreTeam1Game3: ns1, scoreTeam2Game3: ns2, lastScorer: team });
      }
    } else {
      const ns1 = team === 1 ? s1 + 1 : s1;
      const ns2 = team === 2 ? s2 + 1 : s2;
      setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2 });
      setMatchOptimistic(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2, lastScorer: team });
    }
  }

  function subtractScore(team: 1 | 2) {
    if (!activeMatch) return;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const isTwoGame = modeLabel.startsWith("2-21");

    if (isTwoGame) {
      const g2s1 = activeMatch.scoreTeam1Game2 || 0;
      const g2s2 = activeMatch.scoreTeam2Game2 || 0;
      const g3s1 = activeMatch.scoreTeam1Game3 || 0;
      const g3s2 = activeMatch.scoreTeam2Game3 || 0;

      if (curGame === 1) {
        const ns1 = team === 1 ? Math.max(0, s1 - 1) : s1;
        const ns2 = team === 2 ? Math.max(0, s2 - 1) : s2;
        setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2, lastScorer: team } as unknown as ApiMatch);
        setMatchOptimistic(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2 });
      } else if (curGame === 2) {
        const ns1 = team === 1 ? Math.max(0, g2s1 - 1) : g2s1;
        const ns2 = team === 2 ? Math.max(0, g2s2 - 1) : g2s2;
        setActiveMatch({ ...activeMatch, scoreTeam1Game2: ns1, scoreTeam2Game2: ns2 });
        setMatchOptimistic(activeMatch.id, { scoreTeam1Game2: ns1, scoreTeam2Game2: ns2 });
      } else {
        const ns1 = team === 1 ? Math.max(0, g3s1 - 1) : g3s1;
        const ns2 = team === 2 ? Math.max(0, g3s2 - 1) : g3s2;
        setActiveMatch({ ...activeMatch, scoreTeam1Game3: ns1, scoreTeam2Game3: ns2 });
        setMatchOptimistic(activeMatch.id, { scoreTeam1Game3: ns1, scoreTeam2Game3: ns2 });
      }
    } else {
      const ns1 = team === 1 ? Math.max(0, s1 - 1) : s1;
      const ns2 = team === 2 ? Math.max(0, s2 - 1) : s2;
      setActiveMatch({ ...activeMatch, scoreTeam1: ns1, scoreTeam2: ns2 });
      setMatchOptimistic(activeMatch.id, { scoreTeam1: ns1, scoreTeam2: ns2 });
    }
  }

  function swapTeams() {
    if (!activeMatch) return;
    const s = activeMatch;
    const s1 = s.scoreTeam1 || 0;
    const s2 = s.scoreTeam2 || 0;
    const deducedScorer = s1 > s2 ? 1 : s2 > s1 ? 2 : null;
    const liveScorer = (s as unknown as Record<string, unknown>).lastScorer as number | null | undefined;
    const currentScorer = liveScorer ?? deducedScorer;
    const swappedScorer = currentScorer === 1 ? 2 : currentScorer === 2 ? 1 : null;
    const next = {
      ...s,
      team1Player1Id: s.team2Player1Id, team1Player2Id: s.team2Player2Id,
      team2Player1Id: s.team1Player1Id, team2Player2Id: s.team1Player2Id,
      scoreTeam1: s.scoreTeam2, scoreTeam2: s.scoreTeam1,
      scoreTeam1Game2: s.scoreTeam2Game2, scoreTeam2Game2: s.scoreTeam1Game2,
      scoreTeam1Game3: s.scoreTeam2Game3, scoreTeam2Game3: s.scoreTeam1Game3,
    };
    setActiveMatch({ ...next, ...(swappedScorer !== null ? { lastScorer: swappedScorer } : {}) } as unknown as ApiMatch);
    setMatchOptimistic(s.id, {
      team1Player1Id: s.team2Player1Id, team1Player2Id: s.team2Player2Id,
      team2Player1Id: s.team1Player1Id, team2Player2Id: s.team1Player2Id,
      scoreTeam1: s.scoreTeam2, scoreTeam2: s.scoreTeam1,
      scoreTeam1Game2: s.scoreTeam2Game2, scoreTeam2Game2: s.scoreTeam1Game2,
      scoreTeam1Game3: s.scoreTeam2Game3, scoreTeam2Game3: s.scoreTeam1Game3,
      ...(swappedScorer !== null ? { lastScorer: swappedScorer } : {}),
    });
  }

  async function finishMatch(drawArg?: boolean) {
    if (!activeMatch) return;
    setSaving(true);
    const draw = drawArg ?? finishAsDraw;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const isTwoGame = modeLabel.startsWith("2-21");
    let winner: number | null = null;
    if (isTwoGame) {
      const g2s1 = activeMatch.scoreTeam1Game2 || 0;
      const g2s2 = activeMatch.scoreTeam2Game2 || 0;
      const g3s1 = activeMatch.scoreTeam1Game3 || 0;
      const g3s2 = activeMatch.scoreTeam2Game3 || 0;
      if (!draw) {
        const g1Winner = s1 > s2 ? 1 : s2 > s1 ? 2 : null;
        const g2Winner = g2s1 > g2s2 ? 1 : g2s2 > g2s1 ? 2 : null;
        const g3Winner = g3s1 > g3s2 ? 1 : g3s2 > g3s1 ? 2 : null;
        const wins1 = (g1Winner === 1 ? 1 : 0) + (g2Winner === 1 ? 1 : 0) + (g3Winner === 1 ? 1 : 0);
        const wins2 = (g1Winner === 2 ? 1 : 0) + (g2Winner === 2 ? 1 : 0) + (g3Winner === 2 ? 1 : 0);
        winner = wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null;
      }
    } else {
      winner = s1 > s2 ? 1 : s2 > s1 ? 2 : null;
    }
    const fbData: Record<string, unknown> = { status: "completed", winnerTeam: winner, cockCount: Number(cockCount) || 0 };
    fbData.scoreTeam1Game2 = activeMatch.scoreTeam1Game2 ?? null;
    fbData.scoreTeam2Game2 = activeMatch.scoreTeam2Game2 ?? null;
    fbData.scoreTeam1Game3 = activeMatch.scoreTeam1Game3 ?? null;
    fbData.scoreTeam2Game3 = activeMatch.scoreTeam2Game3 ?? null;
    setMatchOptimistic(activeMatch.id, fbData);
    const endedIso = new Date().toISOString();
    try {
      const res = await fetch(`/api/matches/${activeMatch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-pb-id": JSON.parse(localStorage.getItem("user") || "{}").pbId || "" },
        body: JSON.stringify({
          scoreTeam1: activeMatch.scoreTeam1, scoreTeam2: activeMatch.scoreTeam2,
          scoreTeam1Game2: activeMatch.scoreTeam1Game2, scoreTeam2Game2: activeMatch.scoreTeam2Game2,
          scoreTeam1Game3: activeMatch.scoreTeam1Game3, scoreTeam2Game3: activeMatch.scoreTeam2Game3,
          notes: getTimeNotes({ endedAt: endedIso }),
          status: "completed", winnerTeam: winner, cockCount: Number(cockCount) || 0,
        }),
      });
      if (res.ok) {
        const updated = await res.json() as ApiMatch;
        setMatches((prev) => prev.map((m) => m.id === activeMatch!.id ? updated : m));
      }
    } catch {}
    setShowConfirmFinish(false);
    setActiveMatch(null);
    setSaving(false);
  }

  function isGameWon(s1: number, s2: number): boolean {
    const target = modeLabel === "1-42" ? 42 : modeLabel === "1-30" ? 30 : 21;
    if (s1 >= target && s1 - s2 >= 2) return true;
    if (s2 >= target && s2 - s1 >= 2) return true;
    if (s1 >= 30 || s2 >= 30) return true;
    return false;
  }

  async function finishGame1() {
    if (!activeMatch) return;
    const notesStr = getTimeNotes({ game1Finished: true });
    setActiveMatch({ ...activeMatch, notes: notesStr } as unknown as ApiMatch);
    saveToSupabase(activeMatch.id, { notes: notesStr });
    setCurGame(2);
  }

  async function finishGame2() {
    if (!activeMatch) return;
    const notesStr = getTimeNotes({ game2Finished: true });
    setActiveMatch({ ...activeMatch, notes: notesStr } as unknown as ApiMatch);
    saveToSupabase(activeMatch.id, { notes: notesStr });
    setCurGame(3);
  }

  if (!firstDataLoaded && (!schedulesLoaded || !membersLoaded || !matchesLoaded)) return <LoadingSpinner />;

  // --- VIEW 1: Pilih Sparing, League, atau Mabar ---
  if (!selSparingId && !selTournamentId && !selMabarId) {
    return (
      <>
        <SelectionView
          schedules={schedules}
          tournaments={tournaments}
          matches={matches}
          tournamentSchedIds={tournamentSchedIds}
          sparings={sparings}
          mabarSchedules={mabarSchedules}
          pbName={pbName}
          onSelectSparing={(id) => { const s = sparings.find(sp => sp.id === id); if (s?.status === "completed") { setCompletedSparingName(s.sparingOpponent || "Sparing"); setShowCompletedPopup(true); } else { history.pushState(null, ""); setSelSparingId(id); } }}
          onSelectTournament={(id) => { history.pushState(null, ""); setSelTournamentId(id); }}
          onSelectMabar={(id) => { history.pushState(null, ""); setSelMabarId(id); }}
        />
        {showCompletedPopup && <CompletedSparingModal name={completedSparingName} onClose={() => setShowCompletedPopup(false)} />}
      </>
    );
  }

  // --- VIEW 2: Layar Skor Aktif ---
  if (activeMatch) {
    if (loadingMatch) return <LoadingSpinner />;
    const isTwoGame = modeLabel.startsWith("2-21");
    const maxScore = modeLabel === "1-42" ? 42 : 30;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const g2s1 = activeMatch.scoreTeam1Game2 || 0;
    const g2s2 = activeMatch.scoreTeam2Game2 || 0;
    const g3s1 = activeMatch.scoreTeam1Game3 || 0;
    const g3s2 = activeMatch.scoreTeam2Game3 || 0;
    const isEditing = activeMatch.status === "completed";
    const dispS1 = isTwoGame ? (curGame === 1 ? s1 : curGame === 2 ? g2s1 : g3s1) : s1;
    const dispS2 = isTwoGame ? (curGame === 1 ? s2 : curGame === 2 ? g2s2 : g3s2) : s2;
    const scoreTarget = isTwoGame ? 21 : maxScore;
    const g1Won = isGameWon(s1, s2);
    const g2Won = isGameWon(g2s1, g2s2);
    const g3Won = isGameWon(g3s1, g3s2);
    const g1Winner = s1 > s2 ? 1 : s2 > s1 ? 2 : null;
    const g2Winner = g2s1 > g2s2 ? 1 : g2s2 > g2s1 ? 2 : null;
    const splitAfterG2 = isTwoGame && curGame === 2 && g1Won && g2Won && g1Winner !== null && g2Winner !== null && g1Winner !== g2Winner;
    const ci = (activeMatch.courtNumber || 1) - 1;
    const color = courtColors[ci % courtColors.length];

    return (
      <>
        <div className="relative min-h-screen bg-[var(--color-bg)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-4 pt-4">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto flex max-w-lg items-center justify-end gap-2 px-4">
            {isEditing && (
              <button onClick={() => setCardMatch(activeMatch)}
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-white/25">
                <ImageIcon className="h-3.5 w-3.5" /> Buat Card
              </button>
            )}
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
                <div className={`text-5xl font-bold tabular-nums ${dispS1 >= scoreTarget ? "text-green-600" : color.text}`}>
                  {dispS1}
                </div>
                <div className="flex flex-col items-center gap-1 px-3">
                  <span className="text-xs text-gray-300 font-bold">VS</span>
                  <button onClick={swapTeams} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Tukar posisi tim">⇄</button>
                </div>
                <div className={`text-5xl font-bold tabular-nums ${dispS2 >= scoreTarget ? "text-green-600" : color.text}`}>
                  {dispS2}
                </div>
                <div className="flex-1 text-left pl-4">
                  <p className="text-lg font-bold text-gray-900 leading-tight">{getName(activeMatch.team2Player1Id)}</p>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{getName(activeMatch.team2Player2Id)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                {isTwoGame && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${curGame === 1 ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                      Game 1{s1 > 0 || s2 > 0 ? ` (${s1}-${s2})` : ""}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${curGame === 2 ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                      Game 2{g2s1 > 0 || g2s2 > 0 ? ` (${g2s1}-${g2s2})` : ""}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${curGame === 3 ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                      Game 3{g3s1 > 0 || g3s2 > 0 ? ` (${g3s1}-${g3s2})` : ""}
                    </span>
                  </div>
                )}
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

              <div className="mt-6 space-y-2">
                {isEditing ? (
                  <button onClick={() => { setFinishAsDraw(false); setShowConfirmFinish(true); setCockCount(String(activeMatch.cockCount ?? 1)); }} className={`w-full rounded-xl ${color.bg} px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110`}>
                    Simpan Perubahan
                  </button>
                ) : isTwoGame && curGame === 1 && g1Won ? (
                  <button onClick={finishGame1} className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700">
                    Selesai Game 1 ({dispS1}-{dispS2}) → Lanjut Game 2
                  </button>
                ) : splitAfterG2 ? (
                  <>
                    <button onClick={() => setShowConfirmGame3(true)} className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700">
                      Lanjut Rubber Game ({dispS1}-{dispS2}) → Game 3
                    </button>
                    <button onClick={() => { setFinishAsDraw(true); setShowConfirmFinish(true); setCockCount("1"); }} className="w-full rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-500 shadow-sm hover:bg-gray-50">
                      Selesaikan Seri (Game 1 & 2 Berbeda)
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setFinishAsDraw(false); setShowConfirmFinish(true); setCockCount("1"); }} className={`w-full rounded-xl ${color.bg} px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110`}>
                    Selesaikan Pertandingan
                  </button>
                )}
              </div>
            </div>

            {showConfirmFinish && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm" onClick={() => setShowConfirmFinish(false)}>
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{isEditing ? "Simpan Perubahan?" : finishAsDraw ? "Selesaikan Sebagai Seri?" : "Selesaikan Pertandingan?"}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {finishAsDraw ? (
                      <>Game 1: {s1} - {s2}  ·  Game 2: {g2s1} - {g2s2}<br/>Pemenang berbeda, hasil dicatat sebagai <b>Seri</b>.</>
                    ) : isTwoGame ? `Game 1: ${s1} - ${s2}  ·  Game 2: ${g2s1} - ${g2s2}${curGame === 3 || g3s1 > 0 || g3s2 > 0 ? `  ·  Game 3: ${g3s1} - ${g3s2}` : ""}` : `Skor saat ini: ${s1} - ${s2}`}
                  </p>
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <span className="text-sm font-bold text-gray-700">Cock dipakai:</span>
                    <input type="number" value={cockCount} onChange={(e) => setCockCount(e.target.value)} placeholder="1" className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowConfirmFinish(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                    <button disabled={saving} onClick={() => finishMatch()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : isEditing ? "Yakin, Simpan" : finishAsDraw ? "Yakin, Seri" : "Yakin, Selesai"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        {showConfirmGame3 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm" onClick={() => setShowConfirmGame3(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Lanjut Game ke 3?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Game 1: {s1} - {s2}  ·  Game 2: {g2s1} - {g2s2}
                <br/>Pemenang berbeda ({s1 > s2 ? 1 : 2}-{g2s1 > g2s2 ? 1 : 2}), ada rubber game.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowConfirmGame3(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Tidak</button>
                <button onClick={() => { setShowConfirmGame3(false); finishGame2(); }} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700">Ya, Lanjut</button>
              </div>
            </div>
          </div>
        )}
        {showCompletedPopup && <CompletedSparingModal name={completedSparingName} onClose={() => setShowCompletedPopup(false)} />}
        {cardMatch && <MatchCardModal match={cardMatch} members={members} title={cardTitle} pbColor={pbColor} allowUpload onClose={() => setCardMatch(null)} />}
      </>
    );
  }

  // --- VIEW 3: Belum Assign ---
  if (selCourt !== null && selCourt === 0) {
    return (
      <>
        <div className="relative min-h-screen bg-[var(--color-bg)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
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
        {showCompletedPopup && <CompletedSparingModal name={completedSparingName} onClose={() => setShowCompletedPopup(false)} />}
      </>
    );
  }

  // --- VIEW 4: Detail Lapangan + Assign ---
  if (selCourt !== null) {
    const color = courtColors[(selCourt - 1) % courtColors.length];
    return (
      <>
        <div className="relative min-h-screen bg-[var(--color-bg)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm sm:h-14 sm:w-14`}>
                <CourtIcon size={28} color="white" className="sm:size-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white sm:text-2xl">{courts[selCourt - 1]?.name ? (courts[selCourt - 1].name.startsWith("Lap") ? courts[selCourt - 1].name : `Lap. ${courts[selCourt - 1].name}`) : `Lapangan ${selCourt}`}</h1>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                  {courts[selCourt - 1]?.startTime && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {courts[selCourt - 1].startTime.slice(0,5)} - {courts[selCourt - 1].endTime.slice(0,5)}
                    </span>
                  )}
                  <span className="text-white/30">·</span>
                  <span>{courtMatches.length} pertandingan</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-4 flex items-center gap-2">
            {!isMabarMode && (
              <select value={selRound} onChange={(e) => setSelRound(Number(e.target.value))}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>Round {r}</option>
                ))}
              </select>
            )}
            {!isMabarMode && <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--color-primary)]">Round {selRound}</span>}
          </div>

          {unassignedMatches.length > 0 && (
            <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Assign Pertandingan</h3>
              <select value={selAssignMatch} onChange={async (e) => { const v = e.target.value; if (v) { await assignMatch(v, selCourt); setSelAssignMatch(""); } }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
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
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${isCompleted ? "border-gray-200" : "border-gray-200 hover:shadow-md"} ${!isCompleted ? "cursor-pointer hover:border-[var(--color-primary)]" : ""}`}
                    onClick={() => { if (isCompleted) return; openMatchScore(m); }}>
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
                        {isCompleted && (
                          <button onClick={(e) => { e.stopPropagation(); setCardMatch(m); }}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]" title="Buat Match Card"><ImageIcon className="h-3 w-3" /> Card</button>
                        )}
                        {isCompleted && (
                          <button onClick={(e) => { e.stopPropagation(); openMatchScore(m); }}
                            className="rounded-lg border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]" title="Edit skor pertandingan">Edit</button>
                        )}
                        <button onClick={async (e) => { e.stopPropagation(); try { await updateMatch(m.id, { courtNumber: null, ...(m.status !== "completed" ? { status: "scheduled", scoreTeam1: 0, scoreTeam2: 0, scoreTeam1Game2: 0, scoreTeam2Game2: 0, scoreTeam1Game3: 0, scoreTeam2Game3: 0 } : {}) }); } catch (ex) { console.error(ex); } }}
                          className="rounded-lg border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200" title="Lepas dari lapangan">Lepas</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-right">
                        <p className="font-bold text-gray-900">{getName(m.team1Player1Id)} <span className="text-gray-400 font-normal">-</span> {getName(m.team1Player2Id)}</p>
                        {isCompleted && <p className="text-lg font-bold mt-1" style={{ color: m.winnerTeam === 1 ? "var(--color-primary)" : "#6b7280" }}>{m.scoreTeam1}{m.totalGames > 1 && `, ${m.scoreTeam1Game2}`}{m.scoreTeam1Game3 !== null && m.scoreTeam1Game3 !== undefined ? `, ${m.scoreTeam1Game3}` : ""}{m.winnerTeam === null && <span className="ml-1 text-xs font-medium text-amber-500">Seri</span>}</p>}
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-gray-300 font-bold">VS</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-gray-900">{getName(m.team2Player1Id)} <span className="text-gray-400 font-normal">-</span> {getName(m.team2Player2Id)}</p>
                        {isCompleted && <p className="text-lg font-bold mt-1" style={{ color: m.winnerTeam === 2 ? "var(--color-primary)" : "#6b7280" }}>{m.scoreTeam2}{m.totalGames > 1 && `, ${m.scoreTeam2Game2}`}{m.scoreTeam2Game3 !== null && m.scoreTeam2Game3 !== undefined ? `, ${m.scoreTeam2Game3}` : ""}</p>}
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
        {showCompletedPopup && <CompletedSparingModal name={completedSparingName} onClose={() => setShowCompletedPopup(false)} />}
        {cardMatch && <MatchCardModal match={cardMatch} members={members} title={cardTitle} pbColor={pbColor} allowUpload onClose={() => setCardMatch(null)} />}
      </>
    );
  }

  // --- VIEW 5: Grid Lapangan ---
  return (
    <>
      <div className="relative min-h-screen bg-[var(--color-bg)]">
      {/* Header gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-white sm:text-2xl">Control Match</h1>
              <p className="mt-1 text-sm font-medium text-white/80">
                {isTournamentMode
                  ? selectedTournament?.name || "League"
                  : isMabarMode
                    ? selectedMabar?.title || "Mabar"
                    : selectedSparing?.sparingOpponent
                      ? `${pbName || "Sparing"} vs ${selectedSparing.sparingOpponent}`
                      : "Pilih"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-medium backdrop-blur-sm">
                  {modeLabel.includes("2-21") ? "2 Game 21" : modeLabel.includes("42") ? "1 Game 42" : "1 Game 30"}
                </span>
                {isTournamentMode ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-medium backdrop-blur-sm">League</span>
                ) : isMabarMode ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-medium backdrop-blur-sm">Mabar</span>
                ) : savedSettings?.lokasi ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-medium backdrop-blur-sm">
                    {savedSettings.lokasi}
                  </span>
                ) : null}
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
        {isTournamentMode && selectedTournament && (selectedTournament.teams?.length || 0) > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">Klasemen League</h2>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">
                {(selectedTournament.standingsMode || "points") === "score" ? "Total Skor" : "Poin Kemenangan"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Tim</th>
                    <th className="pb-2 pr-2 text-center">M</th>
                    <th className="pb-2 pr-2 text-center">W</th>
                    <th className="pb-2 pr-2 text-center">D</th>
                    <th className="pb-2 pr-2 text-center">L</th>
                    <th className="pb-2 text-center font-bold">{(selectedTournament.standingsMode || "points") === "score" ? "Skor" : "Pts"}</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentStandings.map((s, i) => (
                    <tr key={s.team.id} className="border-b border-gray-50">
                      <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.team.color }} />
                          {s.team.name}
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-center">{s.played}</td>
                      <td className="py-2 pr-2 text-center text-green-600">{s.won}</td>
                      <td className="py-2 pr-2 text-center text-gray-500">{s.drawn}</td>
                      <td className="py-2 pr-2 text-center text-red-500">{s.lost}</td>
                      <td className="py-2 text-center font-bold text-lg">{(selectedTournament.standingsMode || "points") === "score" ? s.score : s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {courts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm">
            <Swords className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Belum ada lapangan</p>
            <p className="text-xs text-gray-400">{isTournamentMode ? "Atur lapangan di menu Pengaturan League" : isMabarMode ? "Atur lapangan di halaman Mabar" : "Atur lapangan di menu Sparing → Pengaturan"}</p>
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
                  className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md sm:p-5 ${hasLive ? `${color.border} border-2` : "border-gray-200 hover:border-[var(--color-primary)]"}`}>
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
                      <h3 className="text-sm font-bold text-gray-900 sm:text-base">{court.name.startsWith("Lap") ? court.name : `Lap. ${court.name}`}</h3>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{court.startTime ? `${court.startTime.slice(0,5)} - ${court.endTime.slice(0,5)}` : ""}</span>
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
                className="group relative overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
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
    {showCompletedPopup && <CompletedSparingModal name={completedSparingName} onClose={() => setShowCompletedPopup(false)} />}
  </>
);
}

function CompletedSparingModal({ name, onClose }: { name: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">Sparing Selesai</h2>
        <p className="mt-2 text-sm text-gray-600">Sparing {name} sudah selesai dan tidak dapat diakses lagi.</p>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Tutup</button>
      </div>
    </div>,
    document.body
  );
}

function SelectionView({ schedules, tournaments, matches, tournamentSchedIds, sparings, mabarSchedules, pbName, onSelectSparing, onSelectTournament, onSelectMabar }: {
  schedules: ApiSchedule[]; tournaments: ApiTournament[]; matches: ApiMatch[];
  tournamentSchedIds: Map<string, string[]>; sparings: ApiSchedule[]; mabarSchedules: ApiSchedule[];
  pbName: string; onSelectSparing: (id: string) => void; onSelectTournament: (id: string) => void; onSelectMabar: (id: string) => void;
}) {
  const tournamentCards = useMemo(() => {
    const seen = new Set<string>();
    const cards: { tournamentId: string; name: string; schedIds: string[]; totalMatches: number; hasLive: boolean }[] = [];
    for (const s of schedules) {
      if (s.tournamentId && !seen.has(s.tournamentId)) {
        seen.add(s.tournamentId);
        const t = tournaments.find((x) => x.id === s.tournamentId);
        const schedIds = tournamentSchedIds.get(s.tournamentId) || [];
        const tMatches = matches.filter((m) => schedIds.includes(m.scheduleId));
        cards.push({
          tournamentId: s.tournamentId,
          name: t?.name || s.title,
          schedIds,
          totalMatches: tMatches.length,
          hasLive: tMatches.some((m) => m.status !== "completed" && m.courtNumber),
        });
      }
    }
    return cards;
  }, [schedules, tournaments, tournamentSchedIds, matches]);

  const [filter, setFilter] = useState<"today" | "all">("today");
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = (s: ApiSchedule) => s.date.split("T")[0] === todayStr;
  const visibleSparings = filter === "all" ? sparings : sparings.filter(isToday);
  const visibleMabar = filter === "all" ? mabarSchedules : mabarSchedules.filter(isToday);
  const visibleTournamentCards =
    filter === "all"
      ? tournamentCards
      : tournamentCards.filter((tc) => tc.schedIds.some((id) => schedules.some((s) => s.id === id && isToday(s))));

  return (
    <div className="relative min-h-screen bg-[var(--color-bg)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <h1 className="text-xl font-bold text-white sm:text-2xl">Controler</h1>
          <p className="mt-1 text-sm font-medium text-white/70">Pilih sparing atau league untuk mengontrol pertandingan</p>
        </div>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Pilih jadwal</h2>
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            <button onClick={() => setFilter("today")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${filter === "today" ? "bg-[var(--color-primary)] text-white" : "text-gray-500 hover:text-gray-700"}`}>Hari Ini</button>
            <button onClick={() => setFilter("all")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${filter === "all" ? "bg-[var(--color-primary)] text-white" : "text-gray-500 hover:text-gray-700"}`}>Semua</button>
          </div>
        </div>
        {visibleTournamentCards.length > 0 && (
          <>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">League</h2>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {visibleTournamentCards.map((tc, i) => {
                const color = courtColors[i % courtColors.length];
                return (
                  <button key={tc.tournamentId} onClick={() => onSelectTournament(tc.tournamentId)}
                    className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
                    {tc.hasLive && (
                      <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-bl-2xl ${color.bg}`}>
                        <Star className="h-4 w-4 text-white" fill="white" />
                      </div>
                    )}
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${color.bg}`}>
                        <Trophy className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 sm:text-base">{tc.name}</h3>
                        <p className="mt-0.5 text-xs text-gray-500">{tc.schedIds.length} sesi pertandingan</p>
                        {tc.hasLive ? (
                          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${color.liveBadge}`}>
                            <Radio className="h-2.5 w-2.5" /> LIVE
                          </span>
                        ) : (
                          <span className="mt-2 text-xs text-gray-400">{tc.totalMatches} pertandingan</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {visibleSparings.length > 0 && (
          <>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Sparing</h2>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {visibleSparings.map((s, i) => {
            const cMatches = matches.filter((m) => m.scheduleId === s.id);
            const hasLive = cMatches.some((m) => m.status !== "completed" && m.courtNumber);
            const color = courtColors[i % courtColors.length];
            return (
              <button key={s.id} onClick={() => onSelectSparing(s.id)}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
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
            </div>
          </>
        )}

        {visibleSparings.length === 0 && visibleTournamentCards.length === 0 && visibleMabar.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center py-10">{filter === "today" ? "Tidak ada jadwal hari ini" : "Belum ada sparing, league, atau mabar"}</p>}

        {visibleMabar.length > 0 && (
          <>
            <h2 className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-gray-500">Mabar</h2>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {visibleMabar.map((s, i) => {
                const cMatches = matches.filter((m) => m.scheduleId === s.id);
                const hasLive = cMatches.some((m) => m.status !== "completed" && m.courtNumber);
                const color = courtColors[i % courtColors.length];
                return (
                  <button key={s.id} onClick={() => onSelectMabar(s.id)}
                    className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-[var(--color-primary)] sm:p-5">
                    {hasLive && (
                      <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-bl-2xl ${color.bg}`}>
                        <Star className="h-4 w-4 text-white" fill="white" />
                      </div>
                    )}
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${color.bg}`}>
                        <Swords className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 sm:text-base">{s.title || "Mabar"}</h3>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}


