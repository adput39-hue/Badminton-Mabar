"use client";

import { useState, useMemo, useEffect } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { Swords, Plus, X, ChevronLeft, Play, Trophy } from "lucide-react";

export default function SparingMatchPage() {
  const { items: schedules } = useApi<ApiSchedule>("schedules");
  const { items: members } = useApi<ApiMember>("members");
  const { items: matches, update: updateMatch } = useApi<ApiMatch>("matches");

  const [selSparingId, setSelSparingId] = useState<string | null>(null);
  const [selCourt, setSelCourt] = useState<number | null>(null);
  const [selRound, setSelRound] = useState(1);
  const [selAssignMatch, setSelAssignMatch] = useState("");
  const [activeMatch, setActiveMatch] = useState<ApiMatch | null>(null);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);

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

  if (!selSparingId) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Match Controller</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sparings.map((s) => (
            <button key={s.id} onClick={() => setSelSparingId(s.id)}
              className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488]">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Swords className="h-4 w-4 text-[#0d9488]" /> vs {s.sparingOpponent}
              </div>
              <p className="mt-1 text-xs text-gray-500">{new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
              <p className="mt-2 text-xs text-gray-400">{matches.filter((m) => m.scheduleId === s.id).length} pertandingan</p>
            </button>
          ))}
          {sparings.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center py-10">Belum ada sparing</p>}
        </div>
      </div>
    );
  }

  if (activeMatch) {
    const isTwoGame = modeLabel.startsWith("2-21");
    const maxScore = modeLabel === "1-42" ? 42 : 30;
    const s1 = activeMatch.scoreTeam1 || 0;
    const s2 = activeMatch.scoreTeam2 || 0;
    const g2s1 = activeMatch.scoreTeam1Game2 || 0;
    const g2s2 = activeMatch.scoreTeam2Game2 || 0;
    const g1Done = isTwoGame && (s1 >= 21 || s2 >= 21);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4">
        <div className="mx-auto w-full max-w-md sm:max-w-2xl">

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Kembali icon */}
          <button onClick={() => setActiveMatch(null)} className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ChevronLeft className="h-4 w-4" /></button>

          {/* Nama + Skor */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1 text-right pr-3">
              <p className="text-base font-bold text-gray-800 leading-tight">{getName(activeMatch.team1Player1Id)}</p>
              <p className="text-base font-bold text-gray-800 leading-tight">{getName(activeMatch.team1Player2Id)}</p>
              {isTwoGame && !g1Done && <p className="mt-1 text-[10px] text-gray-400">Game 1</p>}
              {isTwoGame && g1Done && <p className="mt-1 text-[10px] text-amber-500 font-medium">Game 2</p>}
            </div>
            <div className="text-4xl font-bold text-gray-900 tabular-nums">
              {isTwoGame ? (g1Done ? g2s1 : s1) : s1}
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-xs text-gray-300 font-bold">VS</span>
              <button onClick={swapTeams} className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Tukar posisi tim">⇄</button>
            </div>
            <div className="text-4xl font-bold text-gray-900 tabular-nums">
              {isTwoGame ? (g1Done ? g2s2 : s2) : s2}
            </div>
            <div className="flex-1 text-left pl-3">
              <p className="text-base font-bold text-gray-800 leading-tight">{getName(activeMatch.team2Player1Id)}</p>
              <p className="text-base font-bold text-gray-800 leading-tight">{getName(activeMatch.team2Player2Id)}</p>
              {isTwoGame && !g1Done && <p className="mt-1 text-[10px] text-gray-400">Game 1</p>}
              {isTwoGame && g1Done && <p className="mt-1 text-[10px] text-amber-500 font-medium">Game 2</p>}
            </div>
          </div>

          {/* Tombol +/- */}
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => addScore(1)} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d9488] text-3xl font-bold text-white shadow-lg hover:bg-[#0f766e] active:scale-95 transition-all">+</button>
              <button onClick={() => subtractScore(1)} className="flex h-10 w-16 items-center justify-center rounded-xl border-2 border-gray-200 text-lg font-bold text-gray-500 shadow-sm hover:border-red-300 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all">-</button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => addScore(2)} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d9488] text-3xl font-bold text-white shadow-lg hover:bg-[#0f766e] active:scale-95 transition-all">+</button>
              <button onClick={() => subtractScore(2)} className="flex h-10 w-16 items-center justify-center rounded-xl border-2 border-gray-200 text-lg font-bold text-gray-500 shadow-sm hover:border-red-300 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all">-</button>
            </div>
          </div>

          {/* Selesai */}
          <div className="mt-4">
            <button onClick={() => setShowConfirmFinish(true)} className="w-full rounded-xl bg-[#0d9488] px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e]">Selesai</button>
          </div>
        </div>

        {/* Confirmation modal */}
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
    );
  }

  if (selCourt !== null && selCourt === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <button onClick={() => setSelCourt(null)} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ChevronLeft className="h-4 w-4" /> Kembali ke lapangan</button>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Belum Assign</h2>
        {unassignedMatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
            <Play className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">Semua pertandingan sudah di-assign</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unassignedMatches.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-2xl border border-dashed border-gray-300 bg-white p-4 shadow-sm">
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">{getName(m.team1Player1Id)} & {getName(m.team1Player2Id)}</p>
                  <p className="text-xs text-gray-400">vs {getName(m.team2Player1Id)} & {getName(m.team2Player2Id)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (selCourt !== null) {
    return (
      <div className="mx-auto max-w-6xl">
        <button onClick={() => setSelCourt(null)} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ChevronLeft className="h-4 w-4" /> Kembali ke lapangan</button>

        <h2 className="text-lg font-bold text-gray-900 mb-1">{courts[selCourt - 1]?.name || `Lapangan ${selCourt}`}</h2>

        {/* Round selector */}
        <div className="mb-4 flex items-center gap-2">
          <select value={selRound} onChange={(e) => setSelRound(Number(e.target.value))}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
              <option key={r} value={r}>Round {r}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{roundMatches.filter((m) => m.round === selRound).length} pertandingan</span>
        </div>

        {/* Unassigned matches - quick assign */}
        {unassignedMatches.length > 0 && (
          <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Assign Pertandingan</h3>
            <select value={selAssignMatch} onChange={async (e) => { const v = e.target.value; if (v) { await assignMatch(v, selCourt); setSelAssignMatch(""); } }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
              <option value="" disabled>Pilih pertandingan...</option>
              {unassignedMatches.map((m) => (
                <option key={m.id} value={m.id}>R{m.round} — {getName(m.team1Player1Id)} + {getName(m.team1Player2Id)} vs {getName(m.team2Player1Id)} + {getName(m.team2Player2Id)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Assigned matches */}
        {courtMatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
            <Play className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">Belum ada pertandingan</p>
            <p className="text-xs text-gray-400">Pilih pertandingan dari dropdown di atas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courtMatches.map((m) => (
              <div key={m.id} className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488]">
                <div className="cursor-pointer" onClick={() => setActiveMatch(m)}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-gray-400">Round {m.round}</span>
                    <div className="flex flex-col items-end gap-1">
                      {m.status === "completed" ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700"><Trophy className="h-3 w-3" /> Selesai</span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Live</span>
                      )}
                      <button onClick={async (e) => { e.stopPropagation(); try { await updateMatch(m.id, { courtNumber: null, ...(m.status !== "completed" ? { status: "scheduled", scoreTeam1: 0, scoreTeam2: 0, scoreTeam1Game2: 0, scoreTeam2Game2: 0 } : {}) }); } catch (ex) { console.error(ex); } }} className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200" title="Lepas dari lapangan">Lepas</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex-1 text-right">
                      <p className="font-bold text-gray-900">{getName(m.team1Player1Id)} <span className="text-gray-400 font-normal">-</span> {getName(m.team1Player2Id)}</p>
                      {m.status === "completed" && <p className="text-lg font-bold text-gray-900 mt-1">{m.scoreTeam1}{m.totalGames > 1 && `, ${m.scoreTeam1Game2}`}</p>}
                    </div>
                    <div className="text-xs text-gray-300 font-bold">VS</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-gray-900">{getName(m.team2Player1Id)} <span className="text-gray-400 font-normal">-</span> {getName(m.team2Player2Id)}</p>
                      {m.status === "completed" && <p className="text-lg font-bold text-gray-900 mt-1">{m.scoreTeam2}{m.totalGames > 1 && `, ${m.scoreTeam2Game2}`}</p>}
                    </div>
                  </div>
                  {m.status !== "completed" && (
                    <div className="mt-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-xl bg-[#0d9488] px-4 py-1.5 text-xs font-semibold text-white"><Play className="h-3 w-3" /> Mulai / Input Skor</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Match Controller</h1>
          <p className="text-sm text-gray-500">
            {selectedSparing?.sparingOpponent 
              ? `Sparing vs ${selectedSparing.sparingOpponent} — ${modeLabel.includes("2-21") ? "2 Game 21" : modeLabel.includes("42") ? "1 Game 42" : "1 Game 30"}`
              : "Pilih sparing"}
            {savedSettings?.lokasi ? ` — ${savedSettings.lokasi}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{unassignedMatches.length} belum assign</span>
          <button onClick={() => setSelSparingId(null)} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Ganti Sparing</button>
        </div>
      </div>

      {courts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Swords className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada lapangan</p>
          <p className="text-xs text-gray-400">Setting lapangan di menu Sparing → Pengaturan</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((court, i) => {
            const cMatches = sparingMatches.filter((m) => m.courtNumber === i + 1);
            const completed = cMatches.filter((m) => m.status === "completed").length;
            return (
              <button key={i} onClick={() => setSelCourt(i + 1)}
                className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488]">
                <h3 className="text-sm font-bold text-gray-900">{court.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{court.startTime.slice(0,5)}-{court.endTime.slice(0,5)}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{cMatches.length} pertandingan</span>
                  {completed > 0 && (
                    <span className="rounded-full bg-[#ccfbf1] px-2 py-0.5 text-[10px] font-medium text-[#0d9488]">{completed}/{cMatches.length} selesai</span>
                  )}
                </div>
              </button>
            );
          })}
          {unassignedMatches.length > 0 && (
            <button onClick={() => setSelCourt(0)}
              className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-[#0d9488]">
              <h3 className="text-sm font-bold text-gray-500">Belum Assign</h3>
              <p className="text-xs text-gray-400 mb-3">Pertandingan tanpa lapangan</p>
              <span className="text-xs font-medium text-[#0d9488]">{unassignedMatches.length} pertandingan</span>
            </button>
        )}
      </div>
      )}
    </div>
  );
}
