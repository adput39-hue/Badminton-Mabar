"use client";

import { useState, useMemo, useEffect } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember, ApiAttendance, ApiMatchHistory } from "@/lib/api-types";
import { Swords, UserPlus, Trophy, Medal, Users, Check, XIcon, Plus, ListChecks, Play, BarChart3, Pencil, Clock, Radio, Timer, Star } from "lucide-react";
import CourtIcon from "@/components/court-icon";

const courtColors = [
  { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", badge: "bg-green-100 text-green-700", badgeIcon: "text-green-500", liveBadge: "bg-green-500 text-white" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", badge: "bg-blue-100 text-blue-700", badgeIcon: "text-blue-500", liveBadge: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600", badge: "bg-purple-100 text-purple-700", badgeIcon: "text-purple-500", liveBadge: "bg-purple-500 text-white" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", badge: "bg-amber-100 text-amber-700", badgeIcon: "text-amber-500", liveBadge: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-600", badge: "bg-rose-100 text-rose-700", badgeIcon: "text-rose-500", liveBadge: "bg-rose-500 text-white" },
];

export default function MabarPage() {
  const { items: schedules, update: updateSchedule } = useApi<ApiSchedule>("schedules");
  const { items: members } = useApi<ApiMember>("members");
  const { items: attendances, update: updateAtt, add: addAtt, remove: removeAtt } = useApi<ApiAttendance>("attendances");
  const { items: matches, add: addMatch, update: updateMatch, remove: removeMatch } = useApi<ApiMatch>("matches");
  const { items: history, add: addHistory } = useApi<ApiMatchHistory>("match-history");

  const today = new Date().toISOString().split("T")[0];
  const todaySchedules = schedules.filter((s) => s.date.split("T")[0] === today && s.status !== "cancelled");
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
  const draftMatches = useMemo(() => scheduleMatches.filter((m) => m.courtNumber === null && m.status === "scheduled"), [scheduleMatches]);
  const liveMatches = useMemo(() => scheduleMatches.filter((m) => m.courtNumber !== null && m.status === "scheduled"), [scheduleMatches]);
  const doneMatches = useMemo(() => scheduleMatches.filter((m) => m.status === "completed"), [scheduleMatches]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editMatch, setEditMatch] = useState<ApiMatch | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAbsen, setShowAbsen] = useState(false);
  const [pairMode, setPairMode] = useState<"all" | string>("all");
  const [assignCourtFor, setAssignCourtFor] = useState<string | null>(null);

  function getGameMode(): string {
    if (!schedule?.notes) return "1-30";
    try { const n = JSON.parse(schedule.notes); if (n.gameMode) return n.gameMode; } catch {}
    return "1-30";
  }
  const [gameMode, setGameMode] = useState("1-30");
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

  async function handleScore(matchId: string, score1: number, score2: number, score1g2?: number, score2g2?: number) {
    const m = matches.find((x) => x.id === matchId); if (!m) return;
    let winner: number | null = null;
    if (m.totalGames === 1) {
      winner = score1 > score2 ? 1 : score2 > score1 ? 2 : null;
    } else {
      const g1w = score1 > score2 ? 1 : score2 > score1 ? 2 : null;
      const g2w = score1g2 !== undefined && score2g2 !== undefined ? (score1g2 > score2g2 ? 1 : score2g2 > score1g2 ? 2 : null) : null;
      const wins1 = (g1w === 1 ? 1 : 0) + (g2w === 1 ? 1 : 0);
      const wins2 = (g1w === 2 ? 1 : 0) + (g2w === 2 ? 1 : 0);
      winner = wins1 > wins2 ? 1 : wins2 > wins1 ? 2 : null;
    }
    const upd: Record<string, unknown> = { scoreTeam1: score1, scoreTeam2: score2, winnerTeam: winner, status: "completed" };
    if (score1g2 !== undefined) { upd.scoreTeam1Game2 = score1g2; upd.scoreTeam2Game2 = score2g2; }
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

  const notInvited = members.filter((m) => !invitedIds.includes(m.id) && m.isActive !== false);
  const filteredSearch = searchQ ? notInvited.filter((m) => m.name.toLowerCase().includes(searchQ.toLowerCase())) : notInvited;

  return (
    <div className="relative min-h-screen bg-[#f0fdfa]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-[#0d9488]/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#0d9488]/5 blur-3xl" />
        <div className="absolute top-1/3 right-10 h-32 w-32 rounded-full bg-[#0d9488]/3 blur-2xl" />
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
                  <div className="rounded-xl bg-[#f0fdfa] px-4 py-3 min-w-[100px]">
                    <p className="text-xs text-gray-500">Hadir</p>
                    <p className="text-xl font-bold text-[#0d9488]">{hadirIds.length}</p>
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
                {/* Mini Leaderboard */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Leaderboard</p>
                  <div className="space-y-1">
                    {members.map((m) => ({ ...m, ...(stats.get(m.id) || { wins: 0, losses: 0, total: 0 }) }))
                      .filter((m) => m.total > 0).sort((a, b) => b.wins - a.wins).slice(0, 5)
                      .map((m, i) => (
                        <div key={m.id} className="flex items-center justify-between rounded-lg px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            {i === 0 ? <Medal className="h-3.5 w-3.5 text-[#0d9488]" /> : i === 1 ? <Medal className="h-3.5 w-3.5 text-gray-400" /> : i === 2 ? <Medal className="h-3.5 w-3.5 text-amber-500" /> : <span className="w-3.5 text-[10px] text-gray-400">{i + 1}</span>}
                            <span className="text-xs font-medium text-gray-700">{m.name}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{m.wins}W {m.losses}L</span>
                        </div>
                      ))}
                    {members.filter((m) => (stats.get(m.id)?.total || 0) > 0).length === 0 && <p className="text-[10px] text-gray-400 px-3">Belum ada data</p>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Mode</label>
                <select value={gameMode} onChange={(e) => saveGameMode(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                  <option value="1-30">1G 30</option>
                  <option value="1-42">1G 42</option>
                  <option value="2-21">2G 21</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setShowAbsen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50">Absen</button>
                <button onClick={() => setShowSearch(!showSearch)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"><UserPlus className="h-3.5 w-3.5" /> Tambah</button>
                <button onClick={() => setShowStats(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"><BarChart3 className="h-3.5 w-3.5" /> Rotasi</button>
                {schedule?.status !== "completed" && <button onClick={handleSelesai} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e]"><Check className="h-3.5 w-3.5" /> Selesai</button>}
                <a href="/riwayat" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50">Riwayat</a>
              </div>
            </div>

            {showSearch && (
              <div className="mt-4">
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Cari anggota..." className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
                {filteredSearch.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    {filteredSearch.map((m) => (
                      <button key={m.id} onClick={() => addPeserta(m.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f0fdfa] text-left">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ccfbf1] text-xs font-bold text-[#0d9488]">{m.name[0]}</span>
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
                  <h3 className="flex items-center gap-2 text-base font-bold text-gray-900"><ListChecks className="h-4 w-4 text-[#0d9488]" /> Antrian</h3>
                  <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e]"><Plus className="h-3.5 w-3.5" /> Draft</button>
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
                                <button key={ci} onClick={() => assignCourt(m.id, ci)} className="rounded-lg bg-[#0d9488] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0f766e]">{c.name}</button>
                              ))}
                              <button onClick={() => setAssignCourtFor(null)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">X</button>
                            </div>
                          ) : (
                            courts.length > 0 && <button onClick={() => setAssignCourtFor(m.id)} className="rounded-lg bg-[#ccfbf1] px-3 py-1 text-xs font-medium text-[#0d9488] hover:bg-[#99f6e4]">Assign</button>
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
                    <div className="mt-4 space-y-2">
                      {cMatches.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2 text-center">Lapangan kosong</p>
                      ) : (
                        cMatches.map((m) => <MatchCard key={m.id} match={m} getName={getName} onScore={(s1, s2, s1g2, s2g2) => handleScore(m.id, s1, s2, s1g2, s2g2)} onDelete={() => removeMatch(m.id)} />)
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
          onChangeStatus={async (memberId, status) => {
            const existing = atts.find((a) => a.memberId === memberId);
            if (status === "tidak_jadi" && existing) { await updateAtt(existing.id, { status: "tidak_jadi" }); }
            else if (status === "undangan" && existing) { await removeAtt(existing.id); }
            else if (status === "hadir") {
              if (existing) { await updateAtt(existing.id, { status: "hadir" }); }
              else { await addAtt({ scheduleId: selId, memberId, status: "hadir" }); }
            }
          }}
          onClose={() => setShowAbsen(false)}
        />
      )}
    </div>
    </div>
  );
}

function MatchCard({ match, getName, onScore, onDelete }: {
  match: ApiMatch; getName: (id: string) => string; onScore: (s1: number, s2: number, s1g2?: number, s2g2?: number) => void; onDelete: () => void;
}) {
  const [s1, setS1] = useState(match.scoreTeam1 !== null ? String(match.scoreTeam1) : "");
  const [s2, setS2] = useState(match.scoreTeam2 !== null ? String(match.scoreTeam2) : "");
  const [s1g2, setS1g2] = useState(match.scoreTeam1Game2 !== null ? String(match.scoreTeam1Game2) : "");
  const [s2g2, setS2g2] = useState(match.scoreTeam2Game2 !== null ? String(match.scoreTeam2Game2) : "");
  const [showScore, setShowScore] = useState(false);
  const team1Won = match.winnerTeam === 1; const team2Won = match.winnerTeam === 2;
  const isTwoGames = match.totalGames === 2;
  const modeLabel: Record<string, string> = { "1-30": "1G 30", "1-42": "1G 42", "2-21": "2G 21" };
  const gameMode = match.notes && modeLabel[match.notes] ? match.notes : (isTwoGames ? "2-21" : "1-30");
  const n = (v: string) => Number(v) || 0;
  const g1Filled = s1 !== "" && s2 !== "";
  const g2Filled = s1g2 !== "" && s2g2 !== "";
  const canSave = isTwoGames ? g1Filled && g2Filled : g1Filled;

  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">R{match.round}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{modeLabel[gameMode]}</span>
        </div>
        {match.status === "scheduled" && <button onClick={() => setShowScore(!showScore)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-medium hover:bg-gray-50">Input Skor</button>}
        {match.status === "completed" && (
          <span className="text-xs font-bold text-[#0d9488]">{match.scoreTeam1}-{match.scoreTeam2}{isTwoGames && match.scoreTeam1Game2 !== null ? `, ${match.scoreTeam1Game2}-${match.scoreTeam2Game2}` : ""}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <div className={`rounded-lg border-2 p-2 ${team1Won ? "border-[#0d9488] bg-[#ccfbf1]" : "border-gray-100"}`}>
          <p className="font-medium">{getName(match.team1Player1Id)}</p>
          <p className="text-xs text-gray-400">+</p>
          <p className="font-medium">{getName(match.team1Player2Id)}</p>
          {team1Won && <span className="mt-0.5 inline-block rounded-full bg-[#0d9488] px-2 py-0.5 text-[10px] font-bold text-white">MENANG</span>}
        </div>
        <div className={`rounded-lg border-2 p-2 ${team2Won ? "border-[#0d9488] bg-[#ccfbf1]" : "border-gray-100"}`}>
          <p className="font-medium">{getName(match.team2Player1Id)}</p>
          <p className="text-xs text-gray-400">+</p>
          <p className="font-medium">{getName(match.team2Player2Id)}</p>
          {team2Won && <span className="mt-0.5 inline-block rounded-full bg-[#0d9488] px-2 py-0.5 text-[10px] font-bold text-white">MENANG</span>}
        </div>
      </div>
      {showScore && (
        <div className="mt-2 space-y-2 rounded-lg bg-[#ccfbf1] p-3">
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
          <div className="flex justify-center gap-2">
            <button disabled={!canSave} onClick={() => { setShowScore(false); onScore(n(s1), n(s2), isTwoGames ? n(s1g2) : undefined, isTwoGames ? n(s2g2) : undefined); }} className="rounded-lg bg-[#0d9488] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-50">Simpan</button>
            <button onClick={() => setShowScore(false)} className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceModal({ members, attendances, onChangeStatus, onClose }: {
  members: ApiMember[]; attendances: ApiAttendance[];
  onChangeStatus: (memberId: string, status: ApiAttendance["status"]) => void; onClose: () => void;
}) {
  const hadir = attendances.filter((a) => a.status === "hadir").length;
  const tidakJadi = attendances.filter((a) => a.status === "tidak_jadi").length;
  const belum = attendances.filter((a) => a.status === "undangan").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Absensi</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-4 border-b border-gray-100 px-6 py-3 text-sm">
          <span className="font-medium text-[#0d9488]">✅ Hadir {hadir}</span>
          <span className="font-medium text-red-500">❌ Tidak Jadi {tidakJadi}</span>
          <span className="font-medium text-gray-400">⏳ Belum {belum}</span>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-4">
          {attendances.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Belum ada peserta.</p>
          ) : attendances.map((att) => {
            const m = members.find((x) => x.id === att.memberId);
            if (!m) return null;
            return (
              <div key={att.id} className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-900">{m.name} <span className="text-xs text-gray-400">{m.class}</span></span>
                <div className="flex gap-1">
                  {(["hadir", "tidak_jadi", "undangan"] as ApiAttendance["status"][]).map((s) => (
                    <button key={s} onClick={() => onChangeStatus(m.id, s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        att.status === s
                          ? s === "hadir" ? "bg-[#ccfbf1] text-[#0d9488] border-[#99f6e4] shadow-sm"
                            : s === "tidak_jadi" ? "bg-red-50 text-red-600 border-red-200 shadow-sm"
                            : "bg-gray-100 text-gray-500 border-gray-200 shadow-sm"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}>{s === "hadir" ? "Hadir" : s === "tidak_jadi" ? "Tidak Jadi" : "Belum"}</button>
                  ))}
                </div>
              </div>
            );
          })}
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
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isHadir ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-gray-100 text-gray-400"}`}>{m.name[0]}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-400">Kelas {m.class}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${count === 0 ? "text-red-500" : count <= 2 ? "text-amber-500" : "text-[#0d9488]"}`}>{count}x</span>
                    <span className={`h-2 w-2 rounded-full ${isHadir ? "bg-[#0d9488]" : "bg-gray-300"}`} />
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
  const selected = players.find((p) => p.id === selectedId);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-left focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
        {selected ? <span>{selected.name}</span> : <span className="text-gray-400">{placeholder}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {players.map((p) => {
              const count = playerMatchCounts.get(p.id) || 0;
              return (
                <button key={p.id} type="button" onClick={() => { onSelect(p.id); setOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[#ccfbf1]">
                  <span className="flex-1 truncate text-left">{p.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${classBadgeStyle[p.class] || "bg-gray-100 text-gray-600"}`}>{p.class}</span>
                  <span className="w-8 shrink-0 text-right text-xs text-gray-400">({count})</span>
                </button>
              );
            })}
          </div>
        </>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{editMatch ? "Edit Pertandingan" : "Draft Pertandingan"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><XIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (team1[0] && team1[1] && team2[0] && team2[1]) onSubmit({ team1: [team1[0]!, team1[1]!], team2: [team2[0]!, team2[1]!], totalGames, notes: gameMode }); }} className="space-y-4 p-6">
          {/* Pair Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mode Pairing</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onPairMode("all")} className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${pairMode === "all" ? "bg-[#0d9488] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>All Class</button>
              {classes.map((c) => (
                <button key={c} type="button" onClick={() => onPairMode(c)} className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${pairMode === c ? "bg-[#0d9488] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Kelas {c}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Mode: <span className="font-semibold text-gray-700">{gameMode.startsWith("2") ? "2 Game 21 Poin" : gameMode === "1-42" ? "1 Game 42 Poin" : "1 Game 30 Poin"}</span></span>
            <button type="button" onClick={pairByClass} disabled={filteredHadir.length < 4} className="rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 hover:border-[#0d9488] hover:text-[#0d9488] disabled:opacity-50 whitespace-nowrap">Pair by Class</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={!team1[0] || !team1[1] || !team2[0] || !team2[1]} className="rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-50">{editMatch ? "Simpan" : "Buat Draft"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
