"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/api-store";
import type { ApiTournament, ApiTeam, ApiTeamPlayer, ApiMember, ApiSchedule, ApiMatch } from "@/lib/api-types";
import { Trophy, Plus, X, Trash2, Pencil, ChevronLeft, ExternalLink, Swords } from "lucide-react";
import { useToast } from "@/components/toast";
import { LoadingSpinner } from "@/components/loading-spinner";

function getName(id: string, members: ApiMember[]) { return members.find((m) => m.id === id)?.name || "—"; }

export default function TurnamenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<ApiTournament | null>(null);
  const { items: members } = useApi<ApiMember>("members");
  const { items: matches } = useApi<ApiMatch>("matches");
  const { add: addTeamApi } = useApi<ApiTeam>("teams");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#0d9488");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      if (res.ok) setTournament(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const schedules = useMemo(() => tournament?.schedules?.filter((s): s is ApiSchedule & { team1Id: string; team2Id: string } => !!s.team1Id && !!s.team2Id) || [], [tournament]);
  const teams = useMemo(() => tournament?.teams || [], [tournament]);

  function getTeamName(teamId: string) { return teams.find((t) => t.id === teamId)?.name || "—"; }
  function getTeamColor(teamId: string) { return teams.find((t) => t.id === teamId)?.color || "#0d9488"; }

  const standings = useMemo(() => {
    const map = new Map<string, { team: ApiTeam; played: number; won: number; lost: number; points: number }>();
    for (const t of teams) {
      map.set(t.id, { team: t, played: 0, won: 0, lost: 0, points: 0 });
    }
    for (const s of schedules) {
      const schedMatches = matches.filter((m) => m.scheduleId === s.id);
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
  }, [teams, schedules, matches]);

  async function addTeam() {
    if (!teamName.trim()) return;
    setSavingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: id, name: teamName.trim(), color: teamColor, memberIds: teamMemberIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      setShowAddTeam(false);
      setTeamName("");
      setTeamColor("#0d9488");
      setTeamMemberIds([]);
      toast("success", "Tim berhasil ditambahkan");
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setSavingTeam(false);
    }
  }

  async function removeTeam(teamId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await load();
      toast("success", "Tim berhasil dihapus");
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    }
  }

  async function regenerateStatus() {
    if (!tournament) return;
    const newStatus = tournament.status === "planned" ? "active" : tournament.status === "active" ? "completed" : "planned";
    try {
      const res = await fetch(`/api/tournaments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setTournament((prev) => prev ? { ...prev, status: newStatus } : prev);
    } catch {}
  }

  async function generateSchedules() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/generate`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      await load();
      toast("success", `${data.created} jadwal baru dibuat`);
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>;
  if (!tournament) return <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center"><p className="text-sm text-gray-500">Turnamen tidak ditemukan</p></div>;

  const colors = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
  const internalMembers = members.filter((m) => m.type === "1" || !m.type);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/turnamen" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <p className="text-sm text-gray-500">{teams.length} tim, {schedules.length} sesi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={regenerateStatus}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${tournament.status === "planned" ? "bg-green-500 text-white hover:bg-green-600" : tournament.status === "active" ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
            {tournament.status === "planned" ? "Mulai Turnamen" : tournament.status === "active" ? "Selesaikan" : "Planned"}
          </button>
        </div>
      </div>

      {/* Teams + Standings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Teams */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">Tim <span className="text-xs font-normal text-gray-400">({teams.length})</span></h2>
            <button onClick={() => setShowAddTeam(true)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"><Plus className="h-3 w-3" /> Tambah Tim</button>
          </div>
          {teams.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">Belum ada tim. Tambah tim untuk memulai.</p>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div key={team.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: team.color }} />
                      <span className="text-sm font-semibold text-gray-800">{team.name}</span>
                      <span className="text-[10px] text-gray-400">({team.players?.length || 0} pemain)</span>
                    </div>
                    <button onClick={() => removeTeam(team.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {team.players && team.players.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {team.players.map((tp) => (
                        <span key={tp.id} className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{getName(tp.memberId, members)}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showAddTeam && (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4">
              <h3 className="text-xs font-bold text-gray-700 mb-3">Tambah Tim</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Nama tim"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                  <select value={teamColor} onChange={(e) => setTeamColor(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-2 text-sm">
                    {colors.map((c) => <option key={c} value={c} style={{ backgroundColor: c, color: "#fff" }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Pemain</label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {internalMembers.map((m) => (
                      <button key={m.id} onClick={() => setTeamMemberIds((prev) => prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id])}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${teamMemberIds.includes(m.id) ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {m.name} ({m.class})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowAddTeam(false); setTeamName(""); setTeamMemberIds([]); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Batal</button>
                  <button onClick={addTeam} disabled={!teamName.trim() || savingTeam} className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{savingTeam ? "Menyimpan..." : "Simpan"}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Standings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Klasemen</h2>
          {standings.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">Belum ada pertandingan</p>
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
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.team.color }} />
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

      {/* Generate Jadwal + Sessions */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">Jadwal Pertandingan <span className="text-xs font-normal text-gray-400">({schedules.length})</span></h2>
          <button onClick={generateSchedules} disabled={teams.length < 2 || generating}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
            {generating ? "Menggenerate..." : "Generate Jadwal"}
          </button>
        </div>
        {schedules.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Belum ada jadwal. Generate jadwal setelah tim selesai ditambahkan.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s, i) => {
              const schedMatches = matches.filter((m) => m.scheduleId === s.id);
              const completed = schedMatches.filter((m) => m.winnerTeam != null).length;
              return (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">{i + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{getTeamName(s.team1Id)}</span>
                        <span className="text-xs text-gray-400">vs</span>
                        <span className="font-semibold text-gray-800">{getTeamName(s.team2Id)}</span>
                      </div>
                      <p className="text-[11px] text-gray-400">{schedMatches.length} ganda · {completed} selesai</p>
                    </div>
                  </div>
                  <Link href={`/sparing/match`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"><ExternalLink className="h-3 w-3 inline" /> Buka</Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
