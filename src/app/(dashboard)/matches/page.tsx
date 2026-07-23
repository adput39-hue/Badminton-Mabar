"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch as MatchItem, ApiSchedule as ScheduleItem, ApiMember as MemberItem, ApiAttendance as AttendanceItem, ApiMatchHistory as HistoryItem } from "@/lib/api-types";
import { Plus, X, Swords, Trophy, Medal, Clock, Radio, Timer, Star } from "lucide-react";
import CourtIcon from "@/components/court-icon";

const courtColors = [
  { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", badge: "bg-green-100 text-green-700", liveBadge: "bg-green-500 text-white" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", badge: "bg-blue-100 text-blue-700", liveBadge: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600", badge: "bg-purple-100 text-purple-700", liveBadge: "bg-purple-500 text-white" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", badge: "bg-amber-100 text-amber-700", liveBadge: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-600", badge: "bg-rose-100 text-rose-700", liveBadge: "bg-rose-500 text-white" },
];

export default function MatchesPage() {
  const { items: matches, add: addMatch, update: updateMatch, remove: removeMatch } = useApi<MatchItem>("matches");
  const { items: schedules } = useApi<ScheduleItem>("schedules");
  const { items: members } = useApi<MemberItem>("members");
  const { items: attendances } = useApi<AttendanceItem>("attendances");
  const { items: history, add: addHistory } = useApi<HistoryItem>("match-history");
  const [showForm, setShowForm] = useState(false);

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
  function getAttendees(scheduleId: string) {
    const ids = attendances.filter((a) => a.scheduleId === scheduleId && a.status === "hadir").map((a) => a.memberId);
    return members.filter((m) => ids.includes(m.id));
  }

  async function handleCreateMatch(data: { scheduleId: string; courtNumber: number; round: number; team1: [string, string]; team2: [string, string]; totalGames: number }) {
    await addMatch({ scheduleId: data.scheduleId, courtNumber: data.courtNumber, round: data.round, team1Player1Id: data.team1[0], team1Player2Id: data.team1[1], team2Player1Id: data.team2[0], team2Player2Id: data.team2[1], totalGames: data.totalGames });
    setShowForm(false);
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
      let result: string; if (winner === null) result = "draw"; else if ((isTeam1 && winner === 1) || (!isTeam1 && winner === 2)) result = "win"; else result = "lose";
      await addHistory({ matchId, memberId, partnerId, opponent1Id: opp[0], opponent2Id: opp[1], result });
    }
  }

  const completed = matches.filter((m) => m.status === "completed");
  const scheduled = matches.filter((m) => m.status !== "completed");

  return (
    <div className="relative min-h-screen bg-[#f0fdfa]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-[#0d9488]/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#0d9488]/5 blur-3xl" />
        <div className="absolute top-1/3 right-10 h-32 w-32 rounded-full bg-[#0d9488]/3 blur-2xl" />
      </div>
      <div className="relative mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pertandingan</h1>
          <p className="mt-0.5 text-sm text-gray-500">{matches.length} total &middot; {completed.length} selesai</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md"><Plus className="h-4 w-4" /> Buat Pertandingan</button>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Swords className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada pertandingan</p>
          <p className="text-xs text-gray-400">Absen pemain dulu di jadwal mabar, lalu buat pairing di sini</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {scheduled.map((m) => <MatchCard key={m.id} match={m} schedule={schedules.find((s) => s.id === m.scheduleId)} getName={getName} onScore={(s1, s2, s1g2, s2g2) => handleScore(m.id, s1, s2, s1g2, s2g2)} onDelete={() => removeMatch(m.id)} />)}
            {completed.map((m) => <MatchCard key={m.id} match={m} schedule={schedules.find((s) => s.id === m.scheduleId)} getName={getName} onScore={() => {}} onDelete={() => removeMatch(m.id)} />)}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900"><Trophy className="h-4 w-4 text-yellow-500" /> Leaderboard</h2>
              <div className="mt-4 space-y-2">
                {members.map((m) => ({ ...m, ...(stats.get(m.id) || { wins: 0, losses: 0, total: 0 }) }))
                  .filter((m) => m.total > 0).sort((a, b) => b.wins - a.wins).slice(0, 10)
                  .map((m, i) => (
                    <div key={m.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${i === 0 ? "bg-[#ccfbf1]" : i === 1 ? "bg-gray-50" : i === 2 ? "bg-amber-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        {i === 0 ? <Medal className="h-4 w-4 text-[#0d9488]" /> : i === 1 ? <Medal className="h-4 w-4 text-gray-400" /> : i === 2 ? <Medal className="h-4 w-4 text-amber-500" /> : <span className="w-4 text-xs text-gray-400">{i + 1}</span>}
                        <span className="text-sm font-medium text-gray-900">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#0d9488]">{m.wins}W</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-red-500">{m.losses}L</span>
                      </div>
                    </div>
                  ))}
                {members.filter((m) => (stats.get(m.id)?.total || 0) > 0).length === 0 && <p className="py-4 text-center text-sm text-gray-500">Belum ada data</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && <MatchForm schedules={schedules} getAttendees={getAttendees} onSubmit={handleCreateMatch} onClose={() => setShowForm(false)} />}
    </div>
    </div>
  );
}

function MatchCard({ match, schedule, getName, onScore, onDelete }: {
  match: MatchItem; schedule?: ScheduleItem; getName: (id: string) => string; onScore: (s1: number, s2: number, s1g2?: number, s2g2?: number) => void; onDelete: () => void;
}) {
  const [s1, setS1] = useState(match.scoreTeam1 !== null ? String(match.scoreTeam1) : "");
  const [s2, setS2] = useState(match.scoreTeam2 !== null ? String(match.scoreTeam2) : "");
  const [s1g2, setS1g2] = useState(match.scoreTeam1Game2 !== null ? String(match.scoreTeam1Game2) : "");
  const [s2g2, setS2g2] = useState(match.scoreTeam2Game2 !== null ? String(match.scoreTeam2Game2) : "");
  const [showScore, setShowScore] = useState(false);
  const team1Won = match.winnerTeam === 1; const team2Won = match.winnerTeam === 2;
  const isTwoGames = match.totalGames === 2;
  const n = (v: string) => Number(v) || 0;
  const g1Filled = s1 !== "" && s2 !== "";
  const g2Filled = s1g2 !== "" && s2g2 !== "";
  const canSave = isTwoGames ? g1Filled && g2Filled : g1Filled;
  const ci = (match.courtNumber || 1) - 1;
  const color = courtColors[ci % courtColors.length];
  const hasScore = (match.scoreTeam1 || 0) + (match.scoreTeam2 || 0) > 0;
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all sm:p-6 ${match.status === "completed" ? "border-gray-200" : "border-gray-200 hover:shadow-md"}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${match.status === "completed" ? "bg-gray-300" : color.bg}`}>
          <CourtIcon size={32} color="white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">{schedule?.title || "Pertandingan"}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>L.{match.courtNumber || "—"} · R.{match.round}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {match.status === "scheduled" && (
                <button onClick={() => setShowScore(!showScore)} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium transition-all hover:bg-gray-50">Input Skor</button>
              )}
              {match.status === "completed" && (
                <span className={`rounded-xl px-3 py-1.5 text-sm font-bold shadow-sm ${team1Won || team2Won ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-gray-100 text-gray-500"}`}>
                  {match.scoreTeam1}-{match.scoreTeam2}{isTwoGames && match.scoreTeam1Game2 !== null ? `, ${match.scoreTeam1Game2}-${match.scoreTeam2Game2}` : ""}
                </span>
              )}
              <button onClick={onDelete} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          </div>
          {match.status === "scheduled" && hasScore ? (
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${color.liveBadge}`}><Radio className="h-2.5 w-2.5" /> LIVE</span>
          ) : match.status === "scheduled" ? (
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${color.badge}`}><Timer className="h-2.5 w-2.5" /> Scheduled</span>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-600">SELESAI</span>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className={`rounded-xl border-2 p-4 text-center transition-all ${team1Won ? "border-[#0d9488] bg-[#ccfbf1] shadow-sm" : "border-gray-100"}`}>
          <p className="text-sm font-bold text-gray-900">{getName(match.team1Player1Id)}</p>
          <p className="text-xs text-gray-400">berpasangan dengan</p>
          <p className="text-sm font-bold text-gray-900">{getName(match.team1Player2Id)}</p>
          {team1Won && <span className="mt-1.5 inline-block rounded-full bg-[#0d9488] px-3 py-0.5 text-xs font-bold text-white">MENANG</span>}
        </div>
        <div className={`rounded-xl border-2 p-4 text-center transition-all ${team2Won ? "border-[#0d9488] bg-[#ccfbf1] shadow-sm" : "border-gray-100"}`}>
          <p className="text-sm font-bold text-gray-900">{getName(match.team2Player1Id)}</p>
          <p className="text-xs text-gray-400">berpasangan dengan</p>
          <p className="text-sm font-bold text-gray-900">{getName(match.team2Player2Id)}</p>
          {team2Won && <span className="mt-1.5 inline-block rounded-full bg-[#0d9488] px-3 py-0.5 text-xs font-bold text-white">MENANG</span>}
        </div>
      </div>
      {showScore && <ScoreInput s1={s1} s2={s2} s1g2={s1g2} s2g2={s2g2} onS1={setS1} onS2={setS2} onS1g2={setS1g2} onS2g2={setS2g2} isTwoGames={isTwoGames} canSave={canSave} onSubmit={() => onScore(n(s1), n(s2), isTwoGames ? n(s1g2) : undefined, isTwoGames ? n(s2g2) : undefined)} />}
    </div>
  );
}

function ScoreInput({ s1, s2, s1g2, s2g2, onS1, onS2, onS1g2, onS2g2, isTwoGames, canSave, onSubmit }: {
  s1: string; s2: string; s1g2: string; s2g2: string;
  onS1: (v: string) => void; onS2: (v: string) => void; onS1g2: (v: string) => void; onS2g2: (v: string) => void;
  isTwoGames: boolean; canSave: boolean; onSubmit: () => void;
}) {
  return (
    <div className="mt-4 space-y-2 rounded-xl bg-[#ccfbf1] p-4">
      <div className="flex items-center justify-center gap-3">
        <input type="number" value={s1} onChange={(e) => onS1(e.target.value)} placeholder="0" className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" min={0} />
        <span className="text-sm font-bold text-gray-400">Game 1</span>
        <input type="number" value={s2} onChange={(e) => onS2(e.target.value)} placeholder="0" className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" min={0} />
      </div>
      {isTwoGames && (
        <div className="flex items-center justify-center gap-3">
          <input type="number" value={s1g2} onChange={(e) => onS1g2(e.target.value)} placeholder="0" className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" min={0} />
          <span className="text-sm font-bold text-gray-400">Game 2</span>
          <input type="number" value={s2g2} onChange={(e) => onS2g2(e.target.value)} placeholder="0" className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" min={0} />
        </div>
      )}
      <div className="flex justify-center">
        <button disabled={!canSave} onClick={onSubmit} className="rounded-xl bg-[#0d9488] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md disabled:opacity-50">Simpan</button>
      </div>
    </div>
  );
}

function MatchForm({ schedules, getAttendees, onSubmit, onClose }: {
  schedules: ScheduleItem[]; getAttendees: (s: string) => MemberItem[];
  onSubmit: (d: { scheduleId: string; courtNumber: number; round: number; team1: [string, string]; team2: [string, string]; totalGames: number }) => void; onClose: () => void;
}) {
  const [scheduleId, setScheduleId] = useState(""); const [court, setCourt] = useState(1); const [round, setRound] = useState(1);
  const [totalGames, setTotalGames] = useState(1);
  const [team1, setTeam1] = useState<[string | null, string | null]>([null, null]); const [team2, setTeam2] = useState<[string | null, string | null]>([null, null]);
  const attendees = scheduleId ? getAttendees(scheduleId) : []; const selected = [team1[0], team1[1], team2[0], team2[1]].filter(Boolean) as string[];

  function handleSubmit(e: React.FormEvent) { e.preventDefault(); if (scheduleId && team1[0] && team1[1] && team2[0] && team2[1]) onSubmit({ scheduleId, courtNumber: court, round, team1: [team1[0]!, team1[1]!], team2: [team2[0]!, team2[1]!], totalGames }); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Buat Pertandingan</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div><label className="block text-sm font-medium text-gray-700">Pilih Jadwal</label>
            <select value={scheduleId} onChange={(e) => { setScheduleId(e.target.value); setTeam1([null, null]); setTeam2([null, null]); }} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
              <option value="">-- Pilih jadwal --</option>
              {schedules.filter((s) => s.status !== "cancelled").map((s) => (<option key={s.id} value={s.id}>{s.title} ({new Date(s.date).toLocaleDateString("id-ID")}) - {getAttendees(s.id).length} hadir</option>))}
            </select>
          </div>
          {scheduleId && attendees.length < 4 && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-700">Minimal 4 pemain hadir</p>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Lapangan</label>
              <div className="mt-1.5 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const c = courtColors[(n - 1) % courtColors.length];
                  return (
                    <button key={n} type="button" onClick={() => setCourt(n)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all ${court === n ? `${c.bg} text-white shadow-sm` : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{n}</button>
                  );
                })}
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700">Ronde</label><input type="number" value={round} onChange={(e) => setRound(Number(e.target.value))} min={1} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
            <div><label className="block text-sm font-medium text-gray-700">Game</label>
              <select value={totalGames} onChange={(e) => setTotalGames(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                <option value={1}>1 Game</option>
                <option value={2}>2 Game</option>
              </select>
            </div>
          </div>
          {scheduleId && attendees.length >= 4 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[{ label: "Tim 1", team: team1, st: setTeam1 }, { label: "Tim 2", team: team2, st: setTeam2 }].map(({ label, team, st }) => (
                <div key={label} className="rounded-xl border border-gray-200 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
                  <div className="space-y-2">
                    <select value={team[0] || ""} onChange={(e) => st([e.target.value, team[1]])} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                      <option value="">Pemain 1</option>
                      {attendees.filter((p) => !selected.includes(p.id) || p.id === team[0]).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                    <select value={team[1] || ""} onChange={(e) => st([team[0], e.target.value])} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                      <option value="">Pemain 2</option>
                      {attendees.filter((p) => !selected.includes(p.id) || p.id === team[1]).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={!team1[0] || !team1[1] || !team2[0] || !team2[1]} className="rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] hover:shadow-md disabled:opacity-50">Buat</button>
          </div>
        </form>
      </div>
    </div>
  );
}
