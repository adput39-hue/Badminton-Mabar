"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember, ApiAttendance, ApiMatchHistory } from "@/lib/api-types";
import { useToast } from "@/components/toast";
import { Swords, UserPlus, Trophy, Medal, Users, Check, XIcon, Plus, ListChecks, Play, BarChart3, Pencil, Clock, Radio, Timer, Star, Loader2, Shuffle } from "lucide-react";
import CourtIcon from "@/components/court-icon";
import { LoadingSpinner } from "@/components/loading-spinner";
import { buildPairingSuggestions, type PairingRecord, type PairingSuggestion } from "@/lib/pairing";
import { toDateOnly, todayDateOnly } from "@/lib/utils";

const courtColors = [
  { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", badge: "bg-green-100 text-green-700", badgeIcon: "text-green-500", liveBadge: "bg-green-500 text-white" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", badge: "bg-blue-100 text-blue-700", badgeIcon: "text-blue-500", liveBadge: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600", badge: "bg-purple-100 text-purple-700", badgeIcon: "text-purple-500", liveBadge: "bg-purple-500 text-white" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", badge: "bg-amber-100 text-amber-700", badgeIcon: "text-amber-500", liveBadge: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-600", badge: "bg-rose-100 text-rose-700", badgeIcon: "text-rose-500", liveBadge: "bg-rose-500 text-white" },
];

export default function MabarPage() {
  const { items: schedules, update: updateSchedule, loaded: schedulesLoaded } = useApi<ApiSchedule>("schedules");
  const { items: members, loaded: membersLoaded } = useApi<ApiMember>("members");
  const { items: attendances, update: updateAtt, add: addAtt, remove: removeAtt, loaded: attendancesLoaded } = useApi<ApiAttendance>("attendances", "", 60000);
  const { items: matches, add: addMatch, update: updateMatch, remove: removeMatch, loaded: matchesLoaded } = useApi<ApiMatch>("matches");
  const { items: history, add: addHistory, loaded: historyLoaded } = useApi<ApiMatchHistory>("match-history");

  const today = todayDateOnly();
  const todaySchedules = schedules.filter((s) => toDateOnly(s.date) === today && s.status !== "cancelled");
  const selId = todaySchedules[0]?.id || "";
  const schedule = schedules.find((s) => s.id === selId);
  const noSchedule = todaySchedules.length === 0;

  const atts = useMemo(() => attendances.filter((a) => a.scheduleId === selId), [attendances, selId]);
  const hadirIds = useMemo(() => atts.filter((a) => a.status === "hadir").map((a) => a.memberId), [atts]);
  const invitedIds = useMemo(() => atts.map((a) => a.memberId), [atts]);

  const courts = useMemo(() => {
    if (!schedule?.courts) return [];
    try { return JSON.parse(schedule.courts) as { name: string; startTime: string; endTime: string }[]; } catch { return []; }
  }, [schedule]);

  const scheduleMatches = useMemo(() => matches.filter((m) => m.scheduleId === selId), [matches, selId]);
  const activeMatchIds = useMemo(() => {
    const ids = new Set<string>();
    scheduleMatches.filter((m) => m.status !== "completed").forEach((m) => { [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id].forEach((id) => ids.add(id)); });
    return ids;
  }, [scheduleMatches]);
  const draftMatches = useMemo(() => scheduleMatches.filter((m) => m.courtNumber === null && m.status === "scheduled"), [scheduleMatches]);
  const liveMatches = useMemo(() => scheduleMatches.filter((m) => m.courtNumber !== null && m.status === "scheduled"), [scheduleMatches]);
  const doneMatches = useMemo(() => scheduleMatches.filter((m) => m.status === "completed"), [scheduleMatches]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editMatch, setEditMatch] = useState<ApiMatch | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAbsen, setShowAbsen] = useState(false);
  const [showReferensi, setShowReferensi] = useState(false);
  const [pairMode, setPairMode] = useState<"all" | string>("all");
  const [assignCourtFor, setAssignCourtFor] = useState<string | null>(null);
  const { toast } = useToast();

  function getGameMode(): string {
    if (!schedule?.notes) return "";
    try { const n = JSON.parse(schedule.notes); if (n.gameMode) return n.gameMode; } catch {}
    return "";
  }
  const [gameMode, setGameMode] = useState("");
  useEffect(() => { setGameMode(getGameMode()); }, [schedule?.notes]);

  async function saveGameMode(mode: string) {
    if (!schedule) return;
    setGameMode(mode);
    let merged: Record<string, unknown> = { gameMode: mode };
    if (schedule.notes) {
      try { merged = { ...JSON.parse(schedule.notes), gameMode: mode }; } catch { merged = { text: schedule.notes, gameMode: mode }; }
    }
    await updateSchedule(schedule.id, { notes: JSON.stringify(merged) });
  }

  const uniqueClasses = useMemo(() => [...new Set(members.map((m) => m.class))].sort(), [members]);

  const playerMatchCounts = useMemo(() => {
    const count = new Map<string, number>();
    scheduleMatches.forEach((m) => {
      const ids = [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id];
      ids.forEach((id) => count.set(id, (count.get(id) || 0) + 1));
    });
    return count;
  }, [scheduleMatches]);

  const stats = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; total: number }>();
    history.forEach((h) => {
      const s = map.get(h.memberId) || { wins: 0, losses: 0, total: 0 };
      s.total++; if (h.result === "win") s.wins++; else if (h.result === "lose") s.losses++;
      map.set(h.memberId, s);
    });
    return map;
  }, [history]);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }
  function getMember(id: string) { return members.find((m) => m.id === id); }

  async function toggleHadir(memberId: string) {
    const existing = atts.find((a) => a.memberId === memberId);
    if (!existing) { await addAtt({ scheduleId: selId, memberId, status: "hadir" }); return; }
    if (existing.status === "hadir") { await updateAtt(existing.id, { status: "tidak_jadi" }); }
    else if (existing.status === "tidak_jadi") { await removeAtt(existing.id); }
    else { await updateAtt(existing.id, { status: "hadir" }); }
  }

  async function addPeserta(memberId: string) {
    if (!invitedIds.includes(memberId)) await addAtt({ scheduleId: selId, memberId, status: "undangan" });
    setShowSearch(false); setSearchQ("");
  }

  async function handleCreate(data: { team1: [string, string]; team2: [string, string]; totalGames: number; notes?: string }) {
    if (editMatch) {
      await updateMatch(editMatch.id, {
        team1Player1Id: data.team1[0], team1Player2Id: data.team1[1],
        team2Player1Id: data.team2[0], team2Player2Id: data.team2[1],
        totalGames: data.totalGames, notes: data.notes,
      });
    } else {
      await addMatch({ scheduleId: selId, courtNumber: null, round: draftMatches.length + liveMatches.length + 1, team1Player1Id: data.team1[0], team1Player2Id: data.team1[1], team2Player1Id: data.team2[0], team2Player2Id: data.team2[1], totalGames: data.totalGames, notes: data.notes, status: "scheduled" });
    }
    setShowCreate(false); setEditMatch(null);
  }

  async function handleSelesai() { if (schedule) await updateSchedule(schedule.id, { status: "completed" }); }

  async function assignCourt(matchId: string, courtIdx: number) {
    await updateMatch(matchId, { courtNumber: courtIdx + 1 });
    setAssignCourtFor(null);
  }

  async function handleScore(matchId: string, score1: number, score2: number, cockCount: number, score1g2?: number, score2g2?: number, score1g3?: number, score2g3?: number) {
    const m = matches.find((x) => x.id === matchId); if (!m) return;
    let winner: number | null = null;
    if (m.totalGames === 1) {
      winner = score1 > score2 ? 1 : score2 > score1 ? 2 : null;
    } else {
      const g1w = score1 > score2 ? 1 : score2 > score1 ? 2 : null;
      const g2w = score1g2 !== undefined && score2g2 !== undefined ? (score1g2 > score2g2 ? 1 : score2g2 > score1g2 ? 2 : null) : null;
      const g3w = score1g3 !== undefined && score2g3 !== undefined ? (score1g3 > score2g3 ? 1 : score2g3 > score1g3 ? 2 : null) : null;
      const wins1 = (g1w === 1 ? 1 : 0) + (g2w === 1 ? 1 : 0) + (g3w === 1 ? 1 : 0);
      const wins2 = (g1w === 2 ? 1 : 0) + (g2w === 2 ? 1 : 0) + (g3w === 2 ? 1 : 0);
      winner = wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null;
    }
    const upd: Record<string, unknown> = { scoreTeam1: score1, scoreTeam2: score2, winnerTeam: winner, status: "completed", cockCount };
    if (score1g2 !== undefined) { upd.scoreTeam1Game2 = score1g2; upd.scoreTeam2Game2 = score2g2; }
    if (score1g3 !== undefined) { upd.scoreTeam1Game3 = score1g3; upd.scoreTeam2Game3 = score2g3; } else { upd.scoreTeam1Game3 = null; upd.scoreTeam2Game3 = null; }
    await updateMatch(matchId, upd);
    const team1 = [m.team1Player1Id, m.team1Player2Id], team2 = [m.team2Player1Id, m.team2Player2Id];
    for (const memberId of [...team1, ...team2]) {
      const isTeam1 = team1.includes(memberId);
      const partnerId = isTeam1 ? team1.find((id) => id !== memberId)! : team2.find((id) => id !== memberId)!;
      const opp = isTeam1 ? team2 : team1;
      let result: string;
      if (winner === null) result = "draw";
      else if ((isTeam1 && winner === 1) || (!isTeam1 && winner === 2)) result = "win";
      else result = "lose";
      await addHistory({ matchId, memberId, partnerId, opponent1Id: opp[0], opponent2Id: opp[1], result });
    }
  }

  async function handleFinish(matchId: string) {
    await updateMatch(matchId, { status: "completed", winnerTeam: null });
  }

  async function addFromSuggestion(team1: [string, string], team2: [string, string]) {
    await addMatch({ scheduleId: selId, courtNumber: null, round: draftMatches.length + liveMatches.length + 1, team1Player1Id: team1[0], team1Player2Id: team1[1], team2Player1Id: team2[0], team2Player2Id: team2[1], totalGames: gameMode.startsWith("2") ? 2 : 1, notes: gameMode || undefined, status: "scheduled" });
  }

  const notInvited = members.filter((m) => (m.type === "1" || !m.type) && !invitedIds.includes(m.id) && m.isActive !== false);
  const filteredSearch = searchQ ? notInvited.filter((m) => m.name.toLowerCase().includes(searchQ.toLowerCase())) : notInvited;

  if (!schedulesLoaded || !membersLoaded || !attendancesLoaded || !matchesLoaded || !historyLoaded) return <LoadingSpinner />;

  return (
    <div className="relative min-h-screen bg-[var(--color-bg)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-[var(--color-primary)]/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[var(--color-primary)]/5 blur-3xl" />
        <div className="absolute top-1/3 right-10 h-32 w-32 rounded-full bg-[var(--color-primary)]/3 blur-2xl" />
      </div>
      <div className="relative mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏸 Mabar</h1>
          <p className="mt-0.5 text-sm text-gray-500">{schedule ? `${schedule.title} — ${schedule.location || ""} ${schedule.startTime ? schedule.startTime.slice(0,5) : ""}` : "Tidak ada jadwal hari ini"}</p>
        </div>
      </div>

      {noSchedule ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Play className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada jadwal mabar hari ini</p>
          <p className="text-xs text-gray-400">Buat jadwal dulu di menu Jadwal</p>
        </div>
      ) : (
        <>
          {/* Dashboard */}
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[200px]">
                <h3 className="text-base font-bold text-gray-900 mb-3">📊 Dashboard</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="rounded-xl bg-[var(--color-bg)] px-4 py-3 min-w-[100px]">
                    <p className="text-xs text-gray-500">Hadir</p>
                    <p className="text-xl font-bold text-[var(--color-primary)]">{hadirIds.length}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3 min-w-[100px]">
                    <p className="text-xs text-gray-500">Antrian</p>
                    <p className="text-xl font-bold text-gray-700">{draftMatches.length + liveMatches.length}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3 min-w-[100px]">
                    <p className="text-xs text-gray-500">Selesai</p>
                    <p className="text-xl font-bold text-gray-700">{doneMatches.length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Mode</label>
                <select value={gameMode} onChange={(e) => saveGameMode(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                  <option value="" disabled>Pilih dulu</option>
                  <option value="1-30">1G 30</option>
                  <option value="1-42">1G 42</option>
                  <option value="2-21">2G 21</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setShowAbsen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50">Absen</button>
                <button onClick={() => setShowSearch(!showSearch)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"><UserPlus className="h-3.5 w-3.5" /> Tambah</button>
                <button onClick={() => setShowStats(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"><BarChart3 className="h-3.5 w-3.5" /> Rotasi</button>
                <button onClick={() => setShowReferensi(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"><Shuffle className="h-3.5 w-3.5" /> Referensi</button>
                {schedule?.status !== "completed" && <button onClick={handleSelesai} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-hover)]"><Check className="h-3.5 w-3.5" /> Selesai</button>}
                <a href="/riwayat" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50">Riwayat</a>
              </div>
            </div>

            {showSearch && (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Cari anggota..." className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                  <button onClick={() => { setShowSearch(false); setSearchQ(""); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600" title="Tutup"><XIcon className="h-4 w-4" /></button>
                </div>
                {filteredSearch.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    {filteredSearch.map((m) => (
                      <button key={m.id} onClick={() => addPeserta(m.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[var(--color-bg)] text-left">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">{m.name[0]}</span>
                        <div><p className="font-medium">{m.name}</p><p className="text-xs text-gray-400">Kelas {m.class}</p></div>
                      </button>
                    ))}
                  </div>
                )}
                {filteredSearch.length === 0 && <p className="mt-2 text-xs text-gray-400">Anggota tidak ditemukan atau sudah diundang</p>}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Antrian */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 text-base font-bold text-gray-900"><ListChecks className="h-4 w-4 text-[var(--color-primary)]" /> Antrian</h3>
                  <button onClick={() => setShowCreate(true)} disabled={!gameMode} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"><Plus className="h-3.5 w-3.5" /> Draft</button>
                </div>
                {draftMatches.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center">Belum ada draft pertandingan. Buat draft, lalu assign ke lapangan.</p>
                ) : (
                  <div className="space-y-2">
                    {draftMatches.map((m) => (
                      <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-3">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{getName(m.team1Player1Id)} + {getName(m.team1Player2Id)}</span>
                          <span className="mx-2 text-gray-300">vs</span>
                          <span className="font-medium text-gray-900">{getName(m.team2Player1Id)} + {getName(m.team2Player2Id)}</span>
                          <span className="ml-2 text-xs text-gray-400">R{m.round} · {(m.notes && ["1-30","1-42","2-21"].includes(m.notes)) ? m.notes : `${m.totalGames}G`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignCourtFor === m.id ? (
                            <div className="flex items-center gap-1">
                              {courts.map((c, ci) => (
                                <button key={ci} onClick={() => assignCourt(m.id, ci)} className="rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary-hover)]">{c.name}</button>
                              ))}
                              <button onClick={() => setAssignCourtFor(null)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">X</button>
                            </div>
                          ) : (
                            courts.length > 0 && <button onClick={() => setAssignCourtFor(m.id)} className="rounded-lg bg-[var(--color-primary-light)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-lighter)]">Assign</button>
                          )}
                          <button onClick={() => { setEditMatch(m); setShowCreate(true); }} className="rounded-lg p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removeMatch(m.id)} className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><XIcon className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lapangan */}
              {courts.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2">
                {courts.map((court, ci) => {
                const cMatches = liveMatches.filter((m) => m.courtNumber === ci + 1);
                const cDone = scheduleMatches.filter((m) => m.courtNumber === ci + 1 && m.status === "completed").length;
                const color = courtColors[ci % courtColors.length];
                const hasLive = cMatches.some((m) => (m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0);
                return (
                  <div key={ci} className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6 ${hasLive ? `${color.border} border-2` : "border-gray-200"}`}>
                    {hasLive && (
                      <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-bl-2xl ${color.bg}`}>
                        <Star className="h-4 w-4 text-white" fill="white" />
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${color.bg}`}>
                        <CourtIcon size={40} color="white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900">{court.name}</h3>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{court.startTime.slice(0,5)} - {court.endTime.slice(0,5)}</span>
                        </div>
                        {hasLive ? (
                          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${color.liveBadge}`}>
                            <Radio className="h-3 w-3" /> LIVE
                          </span>
                        ) : cDone > 0 ? (
                          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">SELESAI</span>
                        ) : (
                          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${color.badge}`}>
                            <Timer className={`h-3 w-3 ${color.badgeIcon}`} /> Belum Dimulai
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 max-h-[240px] space-y-2 overflow-y-auto pr-1">
                  {cMatches.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2 text-center">Lapangan kosong</p>
                  ) : (
                    [...cMatches]
                      .sort((a, b) => a.round - b.round)
                      .map((m, mi) => (
                        <MatchCard key={m.id} match={m} getName={getName} isActive={mi === 0} onScore={(s1, s2, cc, s1g2, s2g2, s1g3, s2g3) => handleScore(m.id, s1, s2, cc, s1g2, s2g2, s1g3, s2g3)} onFinish={() => handleFinish(m.id)} onDelete={() => removeMatch(m.id)} onEdit={() => { setEditMatch(m); setShowCreate(true); }} />
                      ))
                  )}
                </div>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <div className={`flex items-center gap-2 text-sm font-medium ${hasLive ? color.text : "text-gray-500"}`}>
                        <Swords className={`h-4 w-4 ${hasLive ? "" : "text-gray-400"}`} />
                        {cMatches.length} pertandingan · {cDone} selesai
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              )}

          </div>
        </>
      )}

      {showCreate && (
        <CreateMatchForm
          editMatch={editMatch}
          hadir={members.filter((m) => hadirIds.includes(m.id))}
          pairMode={pairMode}
          onPairMode={setPairMode}
          classes={uniqueClasses}
          gameMode={gameMode}
          playerMatchCounts={playerMatchCounts}
          onSubmit={handleCreate}
          onClose={() => { setShowCreate(false); setEditMatch(null); }}
        />
      )}
      {showStats && (
        <StatsModal
          members={members}
          playerMatchCounts={playerMatchCounts}
          invitedIds={invitedIds}
          hadirIds={hadirIds}
          onClose={() => setShowStats(false)}
        />
      )}
      {showAbsen && (
        <AttendanceModal
          members={members}
          attendances={atts}
          selId={selId}
          addAtt={addAtt}
          updateAtt={updateAtt}
          onClose={() => setShowAbsen(false)}
        />
      )}
      {showReferensi && (
        <ReferensiModal
          hadir={hadirIds.map((id) => members.find((m) => m.id === id)).filter((m): m is ApiMember => !!m)}
          takenIds={activeMatchIds}
          matchCounts={playerMatchCounts}
          gameMode={gameMode}
          onAdd={addFromSuggestion}
          onClose={() => setShowReferensi(false)}
        />
      )}
    </div>
    </div>
  );
}

function MatchCard({ match, getName, isActive, onScore, onDelete, onFinish, onEdit }: {
  match: ApiMatch; getName: (id: string) => string; isActive?: boolean; onScore: (s1: number, s2: number, cockCount: number, s1g2?: number, s2g2?: number, s1g3?: number, s2g3?: number) => void; onDelete: () => void; onFinish: () => void; onEdit: () => void;
}) {
  const [s1, setS1] = useState(match.scoreTeam1 !== null ? String(match.scoreTeam1) : "");
  const [s2, setS2] = useState(match.scoreTeam2 !== null ? String(match.scoreTeam2) : "");
  const [s1g2, setS1g2] = useState(match.scoreTeam1Game2 !== null ? String(match.scoreTeam1Game2) : "");
  const [s2g2, setS2g2] = useState(match.scoreTeam2Game2 !== null ? String(match.scoreTeam2Game2) : "");
  const [s1g3, setS1g3] = useState(match.scoreTeam1Game3 !== null ? String(match.scoreTeam1Game3) : "");
  const [s2g3, setS2g3] = useState(match.scoreTeam2Game3 !== null ? String(match.scoreTeam2Game3) : "");
  const [cockCount, setCockCount] = useState(match.cockCount !== null ? String(match.cockCount) : "1");
  const [showScore, setShowScore] = useState(false);
  const team1Won = match.winnerTeam === 1; const team2Won = match.winnerTeam === 2;
  const isTwoGames = match.totalGames === 2;
  const modeLabel: Record<string, string> = { "1-30": "1G 30", "1-42": "1G 42", "2-21": "2G 21" };
  const gameMode = match.notes && modeLabel[match.notes] ? match.notes : (isTwoGames ? "2-21" : "1-30");
  const n = (v: string) => Number(v) || 0;
  const g1Filled = s1 !== "" && s2 !== "";
  const g2Filled = s1g2 !== "" && s2g2 !== "";
  const g3Filled = s1g3 !== "" && s2g3 !== "";
  const canSave = isTwoGames ? (g1Filled && g2Filled && ((s1g3 === "" && s2g3 === "") || g3Filled)) : g1Filled;
  const hasG3 = (match.scoreTeam1Game3 || 0) > 0 || (match.scoreTeam2Game3 || 0) > 0;

  return (
    <div className={`rounded-lg p-3 ${isActive ? "border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)]/40" : "border border-gray-100"}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">R{match.round}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{modeLabel[gameMode]}</span>
          {isActive && match.status === "scheduled" && (
            <span className="rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">MAIN</span>
          )}
        </div>
        {match.status === "scheduled" && (
          <div className="flex items-center gap-1">
            {(match.scoreTeam1 || 0) === 0 && (match.scoreTeam2 || 0) === 0 && (
              <button onClick={onEdit} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-medium hover:bg-gray-50">Edit Pemain</button>
            )}
            <button onClick={() => setShowScore(!showScore)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-medium hover:bg-gray-50">Input Skor</button>
            <button onClick={onFinish} className="rounded-lg bg-green-100 px-2.5 py-1 text-[10px] font-medium text-green-700 hover:bg-green-200">Selesai</button>
          </div>
        )}
        {match.status === "completed" && (
          <span className="text-xs font-bold text-[var(--color-primary)]">
            {match.winnerTeam !== null
              ? `${match.scoreTeam1}-${match.scoreTeam2}${isTwoGames && match.scoreTeam1Game2 !== null ? `, ${match.scoreTeam1Game2}-${match.scoreTeam2Game2}` : ""}${hasG3 ? `, ${match.scoreTeam1Game3}-${match.scoreTeam2Game3}` : ""}`
              : "SERI"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <div className={`rounded-lg border-2 p-2 ${team1Won ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-gray-100"}`}>
          <p className="font-medium">{getName(match.team1Player1Id)}</p>
          <p className="text-xs text-gray-400">+</p>
          <p className="font-medium">{getName(match.team1Player2Id)}</p>
          {team1Won && <span className="mt-0.5 inline-block rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-bold text-white">MENANG</span>}
        </div>
        <div className={`rounded-lg border-2 p-2 ${team2Won ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-gray-100"}`}>
          <p className="font-medium">{getName(match.team2Player1Id)}</p>
          <p className="text-xs text-gray-400">+</p>
          <p className="font-medium">{getName(match.team2Player2Id)}</p>
          {team2Won && <span className="mt-0.5 inline-block rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-bold text-white">MENANG</span>}
        </div>
      </div>
      {showScore && (
        <div className="mt-2 space-y-2 rounded-lg bg-[var(--color-primary-light)] p-3">
          <div className="flex items-center justify-center gap-2">
            <input type="number" value={s1} onChange={(e) => setS1(e.target.value)} placeholder="0" className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
            <span className="text-xs font-bold text-gray-400">G1</span>
            <input type="number" value={s2} onChange={(e) => setS2(e.target.value)} placeholder="0" className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
          </div>
          {isTwoGames && (
            <div className="flex items-center justify-center gap-2">
              <input type="number" value={s1g2} onChange={(e) => setS1g2(e.target.value)} placeholder="0" className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
              <span className="text-xs font-bold text-gray-400">G2</span>
              <input type="number" value={s2g2} onChange={(e) => setS2g2(e.target.value)} placeholder="0" className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
            </div>
          )}
          {isTwoGames && (
            <div className="flex items-center justify-center gap-2">
              <input type="number" value={s1g3} onChange={(e) => setS1g3(e.target.value)} placeholder="0" className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
              <span className="text-xs font-bold text-gray-400">G3</span>
              <input type="number" value={s2g3} onChange={(e) => setS2g3(e.target.value)} placeholder="0" className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-bold text-black">Cock</span>
            <input type="number" value={cockCount} onChange={(e) => setCockCount(e.target.value)} placeholder="1" className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm font-bold" min={0} />
          </div>
          <div className="flex justify-center gap-2">
            <button disabled={!canSave} onClick={() => { setShowScore(false); onScore(n(s1), n(s2), n(cockCount), isTwoGames ? n(s1g2) : undefined, isTwoGames ? n(s2g2) : undefined, isTwoGames && g3Filled ? n(s1g3) : undefined, isTwoGames && g3Filled ? n(s2g3) : undefined); }} className="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">Simpan</button>
            <button onClick={() => setShowScore(false)} className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceModal({ members, attendances: atts, selId, addAtt, updateAtt, onClose }: {
  members: ApiMember[]; attendances: ApiAttendance[]; selId: string;
  addAtt: (d: Record<string, unknown>) => Promise<ApiAttendance>;
  updateAtt: (id: string, d: Record<string, unknown>) => Promise<ApiAttendance>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(atts.filter((a) => a.status === "hadir").map((a) => a.memberId))
  );
  const touchedRef = useRef<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [searchAbsen, setSearchAbsen] = useState("");

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      let changed = false;
      atts.forEach((a) => {
        if (touchedRef.current.has(a.memberId)) return;
        const shouldCheck = a.status === "hadir";
        if (shouldCheck && !next.has(a.memberId)) { next.add(a.memberId); changed = true; }
        else if (!shouldCheck && next.has(a.memberId)) { next.delete(a.memberId); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [atts]);

  const hadirCount = selected.size;
  const totalCount = atts.length;

  const filtered = searchAbsen
    ? atts.filter((a) => {
        const m = members.find((x) => x.id === a.memberId);
        return m?.name.toLowerCase().includes(searchAbsen.toLowerCase());
      })
    : atts;

  function toggle(memberId: string) {
    touchedRef.current.add(memberId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];
      for (const att of atts) {
        if (selected.has(att.memberId)) {
          if (att.status !== "hadir") ops.push(updateAtt(att.id, { status: "hadir" }));
        } else {
          if (att.status === "hadir") ops.push(updateAtt(att.id, { status: "undangan" }));
        }
      }
      for (const memberId of selected) {
        if (!atts.find((a) => a.memberId === memberId)) {
          ops.push(addAtt({ scheduleId: selId, memberId, status: "hadir" }));
        }
      }
      await Promise.all(ops);
      touchedRef.current.clear();
      toast("success", "Absensi berhasil disimpan");
      onClose();
    } catch {
      toast("error", "Gagal menyimpan absensi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Absensi</h2>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-4 border-b border-gray-100 px-6 py-3 text-sm">
          <span className="font-medium text-[var(--color-primary)]">✅ Hadir {hadirCount}</span>
          <span className="font-medium text-gray-400">⏳ Total {totalCount}</span>
        </div>
        <div className="px-4 pt-3">
          <input value={searchAbsen} onChange={(e) => setSearchAbsen(e.target.value)} placeholder="Cari anggota..." disabled={saving} className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 disabled:opacity-50" />
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{searchAbsen ? "Anggota tidak ditemukan" : "Belum ada peserta."}</p>
          ) : filtered.map((att) => {
            const m = members.find((x) => x.id === att.memberId);
            if (!m) return null;
            const checked = selected.has(att.memberId);
            return (
              <label key={att.id} className={`flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 transition-colors ${saving ? "" : "hover:bg-gray-50"}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={checked} disabled={saving} onChange={() => toggle(att.memberId)}
                    className="h-5 w-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] disabled:opacity-50" />
                  <span className="text-sm font-medium text-gray-900">{m.name} <span className="text-xs text-gray-400">{m.class}</span></span>
                </div>
                {att.status === "undangan" && !checked && <span className="text-[10px] text-gray-400">undangan</span>}
              </label>
            );
          })}
        </div>
        <div className="border-t border-gray-100 px-6 py-4">
          <button onClick={handleSave} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsModal({ members, playerMatchCounts, invitedIds, hadirIds, onClose }: {
  members: ApiMember[]; playerMatchCounts: Map<string, number>; invitedIds: string[]; hadirIds: string[]; onClose: () => void;
}) {
  const sorted = useMemo(() =>
    (invitedIds.map((id) => members.find((m) => m.id === id))
      .filter(Boolean) as ApiMember[])
      .sort((a, b) => (playerMatchCounts.get(a.id) || 0) - (playerMatchCounts.get(b.id) || 0)),
  [members, playerMatchCounts, invitedIds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Rotasi Pemain</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="max-h-96 overflow-y-auto p-6">
          <div className="space-y-1">
            {sorted.map((m, i) => {
              const count = playerMatchCounts.get(m.id) || 0;
              const isHadir = hadirIds.includes(m.id);
              return (
                <div key={m.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${i < 3 ? "bg-amber-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isHadir ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "bg-gray-100 text-gray-400"}`}>{m.name[0]}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-400">Kelas {m.class}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${count === 0 ? "text-red-500" : count <= 2 ? "text-amber-500" : "text-[var(--color-primary)]"}`}>{count}x</span>
                    <span className={`h-2 w-2 rounded-full ${isHadir ? "bg-[var(--color-primary)]" : "bg-gray-300"}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4">
          <p className="text-xs text-gray-400">Urut dari yang paling sedikit main. Titik hijau = hadir.</p>
        </div>
      </div>
    </div>
  );
}

const classBadgeStyle: Record<string, string> = {
  A: "bg-red-100 text-red-700", B: "bg-orange-100 text-orange-700",
  C: "bg-amber-100 text-amber-700", D: "bg-green-100 text-green-700",
  E: "bg-blue-100 text-blue-700", F: "bg-purple-100 text-purple-700",
};

function PlayerSelect({ players, selectedId, onSelect, placeholder, playerMatchCounts }: {
  players: ApiMember[]; selectedId: string | null; onSelect: (id: string) => void;
  placeholder: string; playerMatchCounts: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = players.find((p) => p.id === selectedId);
  const filtered = query
    ? players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || (p.class || "").toLowerCase().includes(query.toLowerCase()))
    : players;
  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen(!open); setQuery(""); }}
        className="w-full overflow-hidden rounded-lg border border-gray-200 px-4 py-3 text-base text-left focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
        {selected ? <span className="truncate block font-medium">{selected.name}</span> : <span className="text-gray-400">{placeholder}</span>}
      </button>
      {open && (
        <div className="mt-1 rounded-xl border border-gray-200 bg-white shadow-lg">
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Ketik untuk cari..."
            className="w-full rounded-t-xl border-b border-gray-200 px-4 py-2.5 text-base focus:outline-none" />
          <div className="max-h-44 overflow-y-auto">
            {filtered.map((p) => {
              const count = playerMatchCounts.get(p.id) || 0;
              return (
                <button key={p.id} type="button" onClick={() => { onSelect(p.id); setOpen(false); setQuery(""); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-base transition-colors hover:bg-[var(--color-primary-light)]">
                  <span className="flex-1 truncate text-left font-medium">{p.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${classBadgeStyle[p.class] || "bg-gray-100 text-gray-600"}`}>{p.class}</span>
                  <span className="w-8 shrink-0 text-right text-sm text-gray-400">({count})</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-4 py-3 text-center text-xs text-gray-400">Tidak ditemukan</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateMatchForm({ hadir, pairMode, onPairMode, classes, editMatch, gameMode, playerMatchCounts, onSubmit, onClose }: {
  hadir: ApiMember[]; pairMode: "all" | string; onPairMode: (v: "all" | string) => void; classes: string[];
  editMatch: ApiMatch | null; gameMode: string; playerMatchCounts: Map<string, number>;
  onSubmit: (d: { team1: [string, string]; team2: [string, string]; totalGames: number; notes?: string }) => void; onClose: () => void;
}) {
  const totalGames = gameMode.startsWith("2") ? 2 : 1;
  const [team1, setTeam1] = useState<[string | null, string | null]>([editMatch?.team1Player1Id || null, editMatch?.team1Player2Id || null]);
  const [team2, setTeam2] = useState<[string | null, string | null]>([editMatch?.team2Player1Id || null, editMatch?.team2Player2Id || null]);
  const selected = [team1[0], team1[1], team2[0], team2[1]].filter(Boolean) as string[];

  const filteredHadir = useMemo(() => {
    const f = pairMode === "all" ? hadir : hadir.filter((m) => m.class === pairMode);
    return [...f].sort((a, b) => (playerMatchCounts.get(a.id) || 0) - (playerMatchCounts.get(b.id) || 0));
  }, [hadir, pairMode, playerMatchCounts]);
  const groupedByClass = useMemo(() => {
    const g: Record<string, ApiMember[]> = {};
    filteredHadir.forEach((m) => { const c = m.class || "X"; if (!g[c]) g[c] = []; g[c].push(m); });
    return g;
  }, [filteredHadir]);

  function pairByClass() {
    const pairs: { team1: [string, string]; team2: [string, string] }[] = [];
    for (const cls of Object.keys(groupedByClass)) {
      const g = groupedByClass[cls];
      for (let i = 0; i + 3 < g.length; i += 4) {
        pairs.push({ team1: [g[i].id, g[i + 1].id], team2: [g[i + 2].id, g[i + 3].id] });
      }
    }
    if (pairs.length > 0) {
      setTeam1([pairs[0].team1[0], pairs[0].team1[1]]);
      setTeam2([pairs[0].team2[0], pairs[0].team2[1]]);
    }
  }

  function selectP1(which: 1 | 2, slot: 0 | 1, id: string) {
    if (which === 1) { const t: [string | null, string | null] = [...team1]; t[slot] = id; setTeam1(t); }
    else { const t: [string | null, string | null] = [...team2]; t[slot] = id; setTeam2(t); }
  }

  const allPlayers = useMemo(() => filteredHadir, [filteredHadir]);

  function getAvailable(slotTeam: typeof team1, slotIdx: 0 | 1): ApiMember[] {
    return allPlayers.filter((p) => !selected.includes(p.id) || p.id === slotTeam[slotIdx]);
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg self-center rounded-2xl bg-white shadow-2xl my-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{editMatch ? "Edit Pertandingan" : "Draft Pertandingan"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><XIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (team1[0] && team1[1] && team2[0] && team2[1]) onSubmit({ team1: [team1[0]!, team1[1]!], team2: [team2[0]!, team2[1]!], totalGames, notes: gameMode }); }} className="space-y-4 p-6">
          {/* Pair Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mode Pairing</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onPairMode("all")} className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${pairMode === "all" ? "bg-[var(--color-primary)] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>All Class</button>
              {classes.map((c) => (
                <button key={c} type="button" onClick={() => onPairMode(c)} className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${pairMode === c ? "bg-[var(--color-primary)] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Kelas {c}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Mode: <span className="font-semibold text-gray-700">{gameMode.startsWith("2") ? "2 Game 21 Poin" : gameMode === "1-42" ? "1 Game 42 Poin" : "1 Game 30 Poin"}</span></span>
            <button type="button" onClick={pairByClass} disabled={filteredHadir.length < 4 || !gameMode} className="rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50 whitespace-nowrap">Pair by Class</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{ label: "Tim 1", team: team1, t: 1 as const }, { label: "Tim 2", team: team2, t: 2 as const }].map(({ label, team, t }) => (
              <div key={label} className="rounded-xl border border-gray-200 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
                <div className="space-y-2">
                  <PlayerSelect players={getAvailable(team, 0)} selectedId={team[0]} onSelect={(id) => selectP1(t, 0, id)} placeholder="Pemain 1" playerMatchCounts={playerMatchCounts} />
                  <PlayerSelect players={getAvailable(team, 1)} selectedId={team[1]} onSelect={(id) => selectP1(t, 1, id)} placeholder="Pemain 2" playerMatchCounts={playerMatchCounts} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2 pb-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={!team1[0] || !team1[1] || !team2[0] || !team2[1]} className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{editMatch ? "Simpan" : "Buat Draft"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReferensiModal({ hadir, takenIds, matchCounts, gameMode, onAdd, onClose }: {
  hadir: ApiMember[]; takenIds: Set<string>; matchCounts: Map<string, number>; gameMode: string;
  onAdd: (team1: [string, string], team2: [string, string]) => Promise<void>; onClose: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState<string | null>(null);

  const freePlayers = useMemo(() => hadir.filter((m) => !takenIds.has(m.id)), [hadir, takenIds]);
  const takenPlayers = useMemo(() => hadir.filter((m) => takenIds.has(m.id)), [hadir, takenIds]);

  const result = useMemo(() => {
    const records: PairingRecord[] = freePlayers.map((m, idx) => ({ id: m.id, className: m.class || "X", matchCount: matchCounts.get(m.id) || 0, arrival: idx }));
    return buildPairingSuggestions(records);
  }, [freePlayers, matchCounts]);

  const nameOf = (id: string) => hadir.find((m) => m.id === id)?.name || "—";
  const clsOf = (id: string) => hadir.find((m) => m.id === id)?.class || "X";

  async function handleAdd(s: PairingSuggestion) {
    setAdding(s.team1[0] + s.team1[1] + s.team2[0] + s.team2[1]);
    try { await onAdd(s.team1, s.team2); toast("success", "Draft ditambahkan"); }
    catch { toast("error", "Gagal menambah draft"); }
    finally { setAdding(null); }
  }

  const modeLabel = gameMode.startsWith("2") ? "2G 21" : gameMode === "1-42" ? "1G 42" : "1G 30";

  function PlayerLine({ id }: { id: string }) {
    return (
      <span className="flex items-center gap-1.5">
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${classBadgeStyle[clsOf(id)] || "bg-gray-100 text-gray-600"}`}>{clsOf(id)}</span>
        <span className="truncate text-sm font-medium text-gray-900">{nameOf(id)}</span>
        <span className="shrink-0 text-[10px] text-gray-400">({matchCounts.get(id) || 0}x)</span>
      </span>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Shuffle className="h-5 w-5 text-[var(--color-primary)]" /> Referensi Pairing</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-gray-100 px-6 py-3 text-xs text-gray-500">
          Prioritas: yang belum main dulu, lalu yang datang duluan. Pasangan rekan utamakan beda kelas yang cocok, lawan diseimbangkan. {freePlayers.length} pemain bebas · {takenPlayers.length} sudah terjadwal · {result.suggestions.length} usulan pertandingan.
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {result.suggestions.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Belum ada usulan. Pastikan minimal 4 pemain hadir.</p>
          )}
          {result.suggestions.map((s) => (
            <div key={s.team1[0] + s.team1[1] + s.team2[0] + s.team2[1]} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">Tim 1</span>
                      <span className="text-[10px] text-gray-400">res {s.team1Strength} poin</span>
                    </div>
                    <span className="text-[10px] text-gray-400">vs</span>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">res {s.team2Strength} poin</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">Tim 2</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="space-y-1">
                      <PlayerLine id={s.team1[0]} />
                      <PlayerLine id={s.team1[1]} />
                    </div>
                    <span className="text-xs font-bold text-gray-400">vs</span>
                    <div className="space-y-1 text-right">
                      <PlayerLine id={s.team2[0]} />
                      <PlayerLine id={s.team2[1]} />
                    </div>
                  </div>
                </div>
                <button onClick={() => handleAdd(s)} disabled={adding !== null}
                  className="shrink-0 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{adding ? "..." : "Tambah"}</button>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${s.diff <= 1 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                  {s.diff <= 1 ? "Seimbang" : `Selisih ${s.diff}`}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">{modeLabel}</span>
              </div>
            </div>
          ))}

          {takenPlayers.length > 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">Sudah terjadwal ({takenPlayers.length})</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {takenPlayers.map((m) => (
                  <span key={m.id} className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500 ring-1 ring-gray-200">
                    <span className={`rounded-full px-1 py-0.5 text-[8px] font-bold ${classBadgeStyle[m.class] || "bg-gray-100 text-gray-600"}`}>{m.class}</span>
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.leftovers.length > 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-3">
              <p className="mb-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">Tidak ikut ({result.leftovers.length})</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {result.leftovers.map((l) => (
                  <span key={l.id} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500 ring-1 ring-gray-200">{nameOf(l.id)} · {l.reason}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


