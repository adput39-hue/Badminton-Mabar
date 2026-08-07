"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/api-store";
import type { ApiTournament, ApiTeam, ApiTeamPlayer, ApiMember, ApiSchedule, ApiMatch } from "@/lib/api-types";
import { Trophy, Plus, Trash2, ChevronLeft, Swords } from "lucide-react";
import { useToast } from "@/components/toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { compressImage } from "@/lib/compress-image";

function getName(id: string, members: ApiMember[]) { return members.find((m) => m.id === id)?.name || "—"; }

export default function LeagueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<ApiTournament | null>(null);
  const { items: members } = useApi<ApiMember>("members");
  const { items: matches } = useApi<ApiMatch>("matches");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#0d9488");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsGoal, setSettingsGoal] = useState("");
  const [settingsMax, setSettingsMax] = useState("");
  const [settingsFormat, setSettingsFormat] = useState("");
  const [settingsCourts, setSettingsCourts] = useState<{ name: string }[]>([]);
  const [settingsStandingsMode, setSettingsStandingsMode] = useState("points");
  const [settingsWinPoints, setSettingsWinPoints] = useState("");
  const [settingsDrawPoints, setSettingsDrawPoints] = useState("");
  const [settingsLossPoints, setSettingsLossPoints] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Player selection for match creation (sparing-style)
  const [draftTeam1, setDraftTeam1] = useState("");
  const [draftTeam1P1, setDraftTeam1P1] = useState("");
  const [draftTeam1P2, setDraftTeam1P2] = useState("");
  const [draftTeam2, setDraftTeam2] = useState("");
  const [draftTeam2P1, setDraftTeam2P1] = useState("");
  const [draftTeam2P2, setDraftTeam2P2] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [playerDropdownOpen, setPlayerDropdownOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [teamIcon, setTeamIcon] = useState("");
  const playerDropdownRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (playerDropdownRef.current && !playerDropdownRef.current.contains(target)) setPlayerDropdownOpen(false);
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) setColorPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const schedules = useMemo(() => tournament?.schedules?.filter((s): s is ApiSchedule & { team1Id: string; team2Id: string } => !!s.team1Id && !!s.team2Id) || [], [tournament]);
  const teams = useMemo(() => tournament?.teams || [], [tournament]);

  const memberTeamMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of teams) {
      for (const tp of team.players || []) {
        if (!map.has(tp.memberId)) map.set(tp.memberId, team.name);
      }
    }
    return map;
  }, [teams]);

  const allTourneyMatches = useMemo(() => matches.filter((m) => tournament?.schedules?.some((s) => s.id === m.scheduleId)), [matches, tournament]);
  const teamMatchCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of allTourneyMatches) {
      for (const pid of [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id]) {
        const team = teams.find((t) => t.players?.some((tp) => tp.memberId === pid));
        if (team) map.set(team.id, (map.get(team.id) || 0) + 1);
      }
    }
    for (const t of teams) { if (!map.has(t.id)) map.set(t.id, 0); }
    return map;
  }, [allTourneyMatches, teams]);

  function getTeamName(teamId: string) { return teams.find((t) => t.id === teamId)?.name || "—"; }
  function getTeamColor(teamId: string) { return teams.find((t) => t.id === teamId)?.color || "#0d9488"; }

  function renderScheduleItem(s: ApiSchedule & { team1Id: string; team2Id: string }, i: number) {
    const schedMatches = matches.filter((m) => m.scheduleId === s.id);
    const isCompleted = schedMatches.some((m) => m.winnerTeam != null);
    const statusBadge = isCompleted ? "text-green-700 bg-green-50" : schedMatches.some((m) => m.status === "live") ? "text-green-700 bg-green-100" : "text-gray-500 bg-gray-100";
    const statusText = isCompleted ? "Selesai" : schedMatches.some((m) => m.status === "live") ? "LIVE" : "Terjadwal";
    return (
      <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">{i + 1}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">{getTeamName(s.team1Id)}</span>
              <span className="text-xs text-gray-400">vs</span>
              <span className="font-semibold text-gray-800">{getTeamName(s.team2Id)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge}`}>{statusText}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {schedMatches.map((m) => `${getName(m.team1Player1Id, members)}/${getName(m.team1Player2Id, members)} vs ${getName(m.team2Player1Id, members)}/${getName(m.team2Player2Id, members)}`).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && <button onClick={() => { if (confirm("Hapus pertandingan ini?")) deleteSchedule(s.id); }} className="rounded-lg p-1 text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
          <Link href={`/sparing/match?tournamentId=${id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"><Swords className="h-3 w-3 inline" /> Score</Link>
        </div>
      </div>
    );
  }

  function classColor(cls: string) {
    const map: Record<string, string> = { A: "bg-blue-100 text-blue-700", B: "bg-green-100 text-green-700", C: "bg-amber-100 text-amber-700", D: "bg-red-100 text-red-700", Kombi: "bg-purple-100 text-purple-700" };
    return map[cls] || "bg-gray-100 text-gray-600";
  }

  function teamTotalScore(m: ApiMatch, team: 1 | 2) {
    const g1 = team === 1 ? (m.scoreTeam1 || 0) : (m.scoreTeam2 || 0);
    const g2 = team === 1 ? (m.scoreTeam1Game2 || 0) : (m.scoreTeam2Game2 || 0);
    const g3 = team === 1 ? (m.scoreTeam1Game3 || 0) : (m.scoreTeam2Game3 || 0);
    return g1 + g2 + g3;
  }

  const standings = useMemo(() => {
    const mode = tournament?.standingsMode || "points";
    const winPts = tournament?.winPoints ?? 2;
    const drawPts = tournament?.drawPoints ?? 1;
    const lossPts = tournament?.lossPoints ?? 0;
    const map = new Map<string, { team: ApiTeam; played: number; won: number; drawn: number; lost: number; points: number; score: number }>();
    for (const t of teams) {
      map.set(t.id, { team: t, played: 0, won: 0, drawn: 0, lost: 0, points: 0, score: 0 });
    }
    for (const s of schedules) {
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
        t1.score += teamTotalScore(m, 1);
        t2.score += teamTotalScore(m, 2);
      }
    }
    const rows = [...map.values()];
    if (mode === "score") {
      return rows.sort((a, b) => b.score - a.score || b.won - a.won);
    }
    return rows.sort((a, b) => b.points - a.points || b.won - a.won);
  }, [teams, schedules, matches, tournament?.standingsMode, tournament?.winPoints, tournament?.drawPoints, tournament?.lossPoints]);

  const standingsModeLabel = (tournament?.standingsMode || "points") === "score" ? "Total Skor" : "Poin Kemenangan";

  async function addTeam() {
    if (!teamName.trim()) return;
    setSavingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: id, name: teamName.trim(), color: teamColor, icon: teamIcon || null, memberIds: teamMemberIds }),
      });
      if (!res.ok) { const errBody = await res.json().catch(() => null); throw new Error(errBody?.error || (await res.text())); }
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

  async function createMatch() {
    if (!draftTeam1 || !draftTeam2 || !draftTeam1P1 || !draftTeam1P2 || !draftTeam2P1 || !draftTeam2P2) return;
    setSavingMatch(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team1Id: draftTeam1, team2Id: draftTeam2, team1Player1Id: draftTeam1P1, team1Player2Id: draftTeam1P2, team2Player1Id: draftTeam2P1, team2Player2Id: draftTeam2P2 }),
      });
      if (!res.ok) { const errBody = await res.json().catch(() => null); throw new Error(errBody?.error || (await res.text())); }
      await load();
      setShowNewMatch(false);
      setDraftTeam1(""); setDraftTeam1P1(""); setDraftTeam1P2(""); setDraftTeam2(""); setDraftTeam2P1(""); setDraftTeam2P2("");
      toast("success", "Pertandingan berhasil dibuat");
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setSavingMatch(false);
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

  async function deleteSchedule(scheduleId: string) {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await load();
      toast("success", "Pertandingan dihapus");
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/tournaments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalMatchGoal: settingsGoal ? Number(settingsGoal) : null, maxMatchPerTeam: settingsMax ? Number(settingsMax) : null, gameFormat: settingsFormat, courts: settingsCourts.length ? JSON.stringify(settingsCourts) : null, standingsMode: settingsStandingsMode, winPoints: settingsStandingsMode === "points" ? Number(settingsWinPoints) || 0 : null, drawPoints: settingsStandingsMode === "points" ? Number(settingsDrawPoints) || 0 : null, lossPoints: settingsStandingsMode === "points" ? Number(settingsLossPoints) || 0 : null }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      setShowSettings(false);
      toast("success", "Pengaturan disimpan");
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>;
  if (!tournament) return <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center"><p className="text-sm text-gray-500">League tidak ditemukan</p></div>;

  const colors = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
  const internalMembers = members.filter((m) => m.type === "1" || !m.type);
  const formatLabels: Record<string, string> = { "1x30": "1 × 30", "1x42": "1 × 42", "2x21": "2 × 21" };
  const draftFormatLabel = formatLabels[tournament.gameFormat || "1x30"] || "1 × 30";
  const courtList: { name: string }[] = tournament.courts ? JSON.parse(tournament.courts) : [];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/league" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <p className="text-sm text-gray-500">{teams.length} tim, {schedules.length} sesi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setSettingsGoal(String(tournament.totalMatchGoal ?? "")); setSettingsMax(String(tournament.maxMatchPerTeam ?? "")); setSettingsFormat(tournament.gameFormat || "1x30"); setSettingsCourts(tournament.courts ? JSON.parse(tournament.courts) : []); setSettingsStandingsMode(tournament.standingsMode || "points"); setSettingsWinPoints(String(tournament.winPoints ?? 2)); setSettingsDrawPoints(String(tournament.drawPoints ?? 1)); setSettingsLossPoints(String(tournament.lossPoints ?? 0)); setShowSettings(true); }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50">
            Pengaturan
          </button>
          <button onClick={regenerateStatus}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${tournament.status === "planned" ? "bg-green-500 text-white hover:bg-green-600" : tournament.status === "active" ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
            {tournament.status === "planned" ? "Mulai League" : tournament.status === "active" ? "Selesaikan" : "Planned"}
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
                      <div className="flex items-center gap-1">
                        {team.icon ? <img src={team.icon} alt="" className="h-5 w-5 rounded object-cover" /> : <div className="h-4 w-4 rounded-full" style={{ backgroundColor: team.color }} />}
                      </div>
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
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Nama tim"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                <div ref={colorPickerRef} className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Warna / Icon Tim</label>
                  <button type="button" onClick={() => setColorPickerOpen(!colorPickerOpen)}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                    <div className="h-5 w-5 shrink-0 rounded-full border border-gray-300" style={{ backgroundColor: teamColor }} />
                    <span className="text-gray-600">{teamColor}</span>
                    {teamIcon && <span className="text-sm ml-auto">{teamIcon}</span>}
                    <svg className="ml-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {colorPickerOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                      <div className="mb-2 flex flex-wrap gap-2">
                        {colors.map((c) => (
                          <button key={c} type="button" onClick={() => { setTeamColor(c); }}
                            className="h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
                            style={{ backgroundColor: c }}>
                            {teamColor === c && <span className="flex items-center justify-center text-xs text-white">✓</span>}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 pt-2">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-gray-500">Logo Tim</span>
                          {teamIcon && <button type="button" onClick={() => setTeamIcon("")} className="text-[11px] text-red-400 hover:text-red-500">Hapus</button>}
                        </div>
                        {teamIcon ? (
                          <div className="flex items-center gap-3">
                            <img src={teamIcon} alt="logo" className="h-10 w-10 rounded-lg border border-gray-200 object-cover" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-[var(--color-primary)] hover:underline">Ganti gambar</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-xs text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Pilih Gambar
                          </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) { toast("error", "Maksimal 2MB"); return; }
                            compressImage(file, 512).then(setTeamIcon).catch(() => {});
                          }} />
                      </div>
                    </div>
                  )}
                </div>
                <div ref={playerDropdownRef} className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Pemain</label>
                  <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPlayerDropdownOpen(true); }} onFocus={() => setPlayerDropdownOpen(true)} placeholder="Cari pemain..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                  {teamMemberIds.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {teamMemberIds.map((mid) => {
                        const m = members.find((x) => x.id === mid);
                        return m ? (
                          <span key={mid} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-primary)]">
                            {m.name}
                            <span className={`rounded px-1 py-0 text-[10px] font-semibold ${classColor(m.class || "")}`}>{m.class || "—"}</span>
                            <button onClick={() => setTeamMemberIds((prev) => prev.filter((x) => x !== mid))} className="hover:text-red-500 ml-0.5">&times;</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  {playerDropdownOpen && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {internalMembers.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()) && (!memberTeamMap.has(m.id) || teamMemberIds.includes(m.id))).length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400">Tidak ditemukan</p>
                      ) : (
                        internalMembers.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()) && (!memberTeamMap.has(m.id) || teamMemberIds.includes(m.id))).map((m) => {
                          return (
                            <label key={m.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                              <input type="checkbox" checked={teamMemberIds.includes(m.id)} onChange={() => { setTeamMemberIds((prev) => prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]); setSearchQuery(""); }}
                                className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                              {m.name} <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${classColor(m.class || "")}`}>{m.class || "—"}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowAddTeam(false); setTeamName(""); setTeamMemberIds([]); setSearchQuery(""); setTeamIcon(""); setColorPickerOpen(false); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Batal</button>
                  <button onClick={addTeam} disabled={!teamName.trim() || savingTeam} className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{savingTeam ? "Menyimpan..." : "Simpan"}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Standings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">Klasemen</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">{standingsModeLabel}</span>
          </div>
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
                    <th className="pb-2 pr-2 text-center">D</th>
                    <th className="pb-2 pr-2 text-center">L</th>
                    <th className="pb-2 text-center font-bold">{standingsModeLabel === "Total Skor" ? "Skor" : "Pts"}</th>
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
                      <td className="py-2 pr-2 text-center text-gray-500">{s.drawn}</td>
                      <td className="py-2 pr-2 text-center text-red-500">{s.lost}</td>
                      <td className="py-2 text-center font-bold text-lg">{standingsModeLabel === "Total Skor" ? s.score : s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Stats + Buat Pertandingan */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">Pertandingan</h2>
          <button onClick={() => { setShowNewMatch(true); setDraftTeam1(""); setDraftTeam1P1(""); setDraftTeam1P2(""); setDraftTeam2(""); setDraftTeam2P1(""); setDraftTeam2P2(""); }} disabled={teams.length < 2}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
            <Plus className="h-3 w-3" /> Buat Pertandingan
          </button>
        </div>

        {/* Stats */}
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium text-gray-700">
            Total: {allTourneyMatches.length}{tournament?.totalMatchGoal ? ` / ${tournament.totalMatchGoal}` : ""}
          </span>
          {teams.map((t) => {
            const played = teamMatchCount.get(t.id) || 0;
            return (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-3 py-1.5 text-gray-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}: {played}{tournament?.maxMatchPerTeam ? ` / ${tournament.maxMatchPerTeam}` : ""}
              </span>
            );
          })}
        </div>

        {/* Buat Pertandingan Form */}
        {showNewMatch && (
          <div className="mb-4 rounded-xl border border-dashed border-gray-300 p-4">
            <h3 className="mb-3 text-xs font-bold text-gray-700">Pertandingan Baru <span className="font-normal text-gray-400">({draftFormatLabel})</span></h3>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Tim A */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">Tim A</label>
                <select value={draftTeam1} onChange={(e) => { setDraftTeam1(e.target.value); setDraftTeam1P1(""); setDraftTeam1P2(""); }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                  <option value="">—</option>
                  {teams.filter((t) => t.id !== draftTeam2).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {draftTeam1 && (
                  <div className="mt-2 flex gap-2">
                    <select value={draftTeam1P1} onChange={(e) => setDraftTeam1P1(e.target.value)}
                      className="w-1/2 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                      <option value="">Pemain 1</option>
                      {(teams.find((t) => t.id === draftTeam1)?.players || []).map((tp) => {
                        const m = members.find((mm) => mm.id === tp.memberId);
                        return <option key={tp.id} value={tp.memberId}>{m?.name} ({m?.class})</option>;
                      })}
                    </select>
                    <select value={draftTeam1P2} onChange={(e) => setDraftTeam1P2(e.target.value)}
                      className="w-1/2 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                      <option value="">Pemain 2</option>
                      {(teams.find((t) => t.id === draftTeam1)?.players || []).filter((tp) => tp.memberId !== draftTeam1P1).map((tp) => {
                        const m = members.find((mm) => mm.id === tp.memberId);
                        return <option key={tp.id} value={tp.memberId}>{m?.name} ({m?.class})</option>;
                      })}
                    </select>
                  </div>
                )}
              </div>
              {/* Tim B */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">Tim B</label>
                <select value={draftTeam2} onChange={(e) => { setDraftTeam2(e.target.value); setDraftTeam2P1(""); setDraftTeam2P2(""); }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                  <option value="">—</option>
                  {teams.filter((t) => t.id !== draftTeam1).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {draftTeam2 && (
                  <div className="mt-2 flex gap-2">
                    <select value={draftTeam2P1} onChange={(e) => setDraftTeam2P1(e.target.value)}
                      className="w-1/2 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                      <option value="">Pemain 1</option>
                      {(teams.find((t) => t.id === draftTeam2)?.players || []).map((tp) => {
                        const m = members.find((mm) => mm.id === tp.memberId);
                        return <option key={tp.id} value={tp.memberId}>{m?.name} ({m?.class})</option>;
                      })}
                    </select>
                    <select value={draftTeam2P2} onChange={(e) => setDraftTeam2P2(e.target.value)}
                      className="w-1/2 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                      <option value="">Pemain 2</option>
                      {(teams.find((t) => t.id === draftTeam2)?.players || []).filter((tp) => tp.memberId !== draftTeam2P1).map((tp) => {
                        const m = members.find((mm) => mm.id === tp.memberId);
                        return <option key={tp.id} value={tp.memberId}>{m?.name} ({m?.class})</option>;
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowNewMatch(false); setDraftTeam1(""); setDraftTeam1P1(""); setDraftTeam1P2(""); setDraftTeam2(""); setDraftTeam2P1(""); setDraftTeam2P2(""); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={createMatch} disabled={!draftTeam1 || !draftTeam2 || !draftTeam1P1 || !draftTeam1P2 || !draftTeam2P1 || !draftTeam2P2 || savingMatch}
                className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{savingMatch ? "Menyimpan..." : "Buat"}</button>
            </div>
          </div>
        )}

        {/* Daftar Pertandingan */}
        {schedules.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Belum ada pertandingan</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s, i) => renderScheduleItem(s, i))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Pengaturan League</h2>
              <button onClick={() => setShowSettings(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">&times;</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Pertandingan</label>
                  <input type="number" min="1" value={settingsGoal} onChange={(e) => setSettingsGoal(e.target.value)} placeholder="Misal: 20"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max per Tim</label>
                  <input type="number" min="1" value={settingsMax} onChange={(e) => setSettingsMax(e.target.value)} placeholder="Misal: 5"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Format Game</label>
                <select value={settingsFormat} onChange={(e) => setSettingsFormat(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                  <option value="1x30">1 × 30</option>
                  <option value="1x42">1 × 42</option>
                  <option value="2x21">2 × 21</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Klasemen Berdasarkan</label>
                <select value={settingsStandingsMode} onChange={(e) => setSettingsStandingsMode(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                  <option value="points">Poin Kemenangan</option>
                  <option value="score">Total Skor</option>
                </select>
              </div>
              {settingsStandingsMode === "points" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Menang</label>
                    <input type="number" min="0" value={settingsWinPoints} onChange={(e) => setSettingsWinPoints(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Seri</label>
                    <input type="number" min="0" value={settingsDrawPoints} onChange={(e) => setSettingsDrawPoints(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Kalah</label>
                    <input type="number" min="0" value={settingsLossPoints} onChange={(e) => setSettingsLossPoints(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Lapangan</label>
                <div className="space-y-2">
                  {settingsCourts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={c.name} onChange={(e) => { const next = [...settingsCourts]; next[i] = { name: e.target.value }; setSettingsCourts(next); }}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" placeholder="Nama lapangan" />
                      <button onClick={() => setSettingsCourts((prev) => prev.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50">&times;</button>
                    </div>
                  ))}
                  <button onClick={() => setSettingsCourts((prev) => [...prev, { name: "" }])} className="text-sm text-[var(--color-primary)] hover:underline">+ Tambah Lapangan</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowSettings(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={saveSettings} disabled={savingSettings} className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{savingSettings ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
