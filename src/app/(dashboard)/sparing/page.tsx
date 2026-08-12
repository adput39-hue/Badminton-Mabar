"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember, ApiAttendance } from "@/lib/api-types";
import { Swords, Plus, X, Trash2, Pencil, ExternalLink, XCircle, Check } from "lucide-react";
import { useToast } from "@/components/toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { compressImage } from "@/lib/compress-image";
import { todayDateOnly } from "@/lib/utils";

function getOpponentMemberIds(schedule: ApiSchedule): string[] {
  if (!schedule.notes) return [];
  try {
    const parsed = JSON.parse(schedule.notes);
    if (Array.isArray(parsed.opponentMemberIds)) return parsed.opponentMemberIds;
  } catch {}
  return [];
}

const classBadge: Record<string, string> = {
  A: "bg-red-100 text-red-700", B: "bg-orange-100 text-orange-700",
  C: "bg-amber-100 text-amber-700", D: "bg-green-100 text-green-700",
  E: "bg-blue-100 text-blue-700", F: "bg-purple-100 text-purple-700",
};

const classColors: Record<string, string> = {
  A: "bg-gradient-to-br from-red-500 to-red-600", B: "bg-gradient-to-br from-orange-500 to-orange-600",
  C: "bg-gradient-to-br from-amber-500 to-amber-600", D: "bg-gradient-to-br from-green-500 to-green-600",
  E: "bg-gradient-to-br from-blue-500 to-blue-600", F: "bg-gradient-to-br from-purple-500 to-purple-600",
};

export default function SparingPage() {
  const { items: schedules, add: addSchedule, update: updateSchedule, loaded: schedulesLoaded } = useApi<ApiSchedule>("schedules");
  const { items: members, add: addMember, update: updateMember, remove: removeMember, loaded: membersLoaded } = useApi<ApiMember>("members");
  const { items: matches, add: addMatch, update: updateMatch, remove: removeMatch, loaded: matchesLoaded } = useApi<ApiMatch>("matches");
  const { items: attendances, add: addAtt, remove: removeAtt, loaded: attendancesLoaded } = useApi<ApiAttendance>("attendances");

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

  const [showCreate, setShowCreate] = useState(false);
  const [formDate, setFormDate] = useState(todayDateOnly());
  const [formOpponent, setFormOpponent] = useState("");
  const [formLogo, setFormLogo] = useState("");
  const [opponentPlayers, setOpponentPlayers] = useState<{ name: string; class: string }[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [playerClass, setPlayerClass] = useState("");
  const [editPlayerIdx, setEditPlayerIdx] = useState<number | null>(null);
  const [selSparingId, setSelSparingId] = useState<string | null>(null);

  function handleFormLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 512).then((dataUrl) => setFormLogo(dataUrl)).catch(() => {});
  }
  const [editOppId, setEditOppId] = useState<string | null>(null);
  const [editOppName, setEditOppName] = useState("");
  const [editOppClass, setEditOppClass] = useState("");
  const [newOppName, setNewOppName] = useState("");
  const [newOppClass, setNewOppClass] = useState("");
  const [pendingOpponents, setPendingOpponents] = useState<{ name: string; class: string }[]>([]);
  const [showAddOur, setShowAddOur] = useState(false);
  const [showAddOpp, setShowAddOpp] = useState(false);
  const [tab, setTab] = useState<"pengaturan" | "draft">("pengaturan");
  const [draftOur1, setDraftOur1] = useState("");
  const [draftOur2, setDraftOur2] = useState("");
  const [draftOpp1, setDraftOpp1] = useState("");
  const [draftOpp2, setDraftOpp2] = useState("");
  const [draftGames, setDraftGames] = useState("1-30");
  const [pendingNewMatches, setPendingNewMatches] = useState<{ round: number; team1Player1Id: string; team1Player2Id: string; team2Player1Id: string; team2Player2Id: string; totalGames: number; notes: string }[]>([]);
  const [pendingCourt, setPendingCourt] = useState<Record<string, number | null>>({});
  const [savingDraft, setSavingDraft] = useState(false);
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [editSparingName, setEditSparingName] = useState("");
  const [isEditingSparing, setIsEditingSparing] = useState(false);
  const [editPendingIdx, setEditPendingIdx] = useState<number | null>(null);
  const [editMatchOur1, setEditMatchOur1] = useState("");
  const [editMatchOur2, setEditMatchOur2] = useState("");
  const [editMatchOpp1, setEditMatchOpp1] = useState("");
  const [editMatchOpp2, setEditMatchOpp2] = useState("");
  const [editLogo, setEditLogo] = useState("");

  function handleEditLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 512).then((dataUrl) => setEditLogo(dataUrl)).catch(() => {});
  }
  const [editMatchMode, setEditMatchMode] = useState("1-30");
  const [matchesPerRound, setMatchesPerRound] = useState(10);
  const [totalRoundsSetting, setTotalRoundsSetting] = useState(1);
  const [selectedRound, setSelectedRound] = useState(1);
  const [lapanganList, setLapanganList] = useState<{ name: string; startTime: string; endTime: string }[]>([]);
  const [showAddLapangan, setShowAddLapangan] = useState(false);
  const [lapName, setLapName] = useState("");
  const [lapStart, setLapStart] = useState("");
  const [lapEnd, setLapEnd] = useState("");
  const [editLapIdx, setEditLapIdx] = useState<number | null>(null);
  const [lokasi, setLokasi] = useState("");
  const [htm, setHtm] = useState(0);
  const [saving, setSaving] = useState(false);
  const [firstDataLoaded, setFirstDataLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (schedulesLoaded && membersLoaded && matchesLoaded && attendancesLoaded && !firstDataLoaded) {
      setFirstDataLoaded(true);
    }
  }, [schedulesLoaded, membersLoaded, matchesLoaded, attendancesLoaded, firstDataLoaded]);

  const modeLabel: Record<string, string> = { "1-30": "1 Game 30 Poin", "1-42": "1 Game 42 Poin", "2-21": "2 Game 21 Poin" };

  const sparings = useMemo(() =>
    schedules.filter((s) => s.sparingOpponent).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [schedules]);

  const internalMembers = useMemo(() => members.filter((m) => m.type === "1" || !m.type), [members]);
  const externalMembers = useMemo(() => members.filter((m) => m.type === "2"), [members]);

  const selectedSparing = sparings.find((s) => s.id === selSparingId);
  const sparingMatches = useMemo(() =>
    matches.filter((m) => m.scheduleId === selSparingId).sort((a, b) => a.round - b.round || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  [matches, selSparingId]);
  const totalRounds = useMemo(() => Math.max(1, totalRoundsSetting), [totalRoundsSetting]);
  const roundMatches = useMemo(() => sparingMatches.filter((m) => m.round === selectedRound), [sparingMatches, selectedRound]);

  function addPlayer() {
    if (!playerName.trim() || !playerClass) return;
    if (editPlayerIdx !== null) {
      const updated = [...opponentPlayers];
      updated[editPlayerIdx] = { name: playerName.trim(), class: playerClass };
      setOpponentPlayers(updated);
      setEditPlayerIdx(null);
    } else {
      setOpponentPlayers([...opponentPlayers, { name: playerName.trim(), class: playerClass }]);
    }
    setPlayerName("");
    setPlayerClass("");
  }

  function editPlayer(i: number) {
    setPlayerName(opponentPlayers[i].name);
    setPlayerClass(opponentPlayers[i].class);
    setEditPlayerIdx(i);
  }

  function removePlayer(i: number) {
    setOpponentPlayers(opponentPlayers.filter((_, idx) => idx !== i));
    if (editPlayerIdx === i) { setEditPlayerIdx(null); setPlayerName(""); setPlayerClass(""); }
  }

  async function handleCreate() {
    if (!formOpponent.trim()) return;
    const sched = await addSchedule({
      title: `Sparing vs ${formOpponent.trim()}`,
      date: new Date(formDate).toISOString(),
      sparingOpponent: formOpponent.trim(),
      logoUrl: formLogo || null,
      status: "planned",
    });
    const memberIds: string[] = [];
    for (const p of opponentPlayers) {
      const m = await addMember({ name: p.name, class: p.class, type: "2" });
      memberIds.push(m.id);
    }
    if (sched && memberIds.length > 0) {
      await updateSchedule(sched.id, { notes: JSON.stringify({ opponentMemberIds: memberIds }) });
    }
    setShowCreate(false);
    setFormOpponent("");
    setFormLogo("");
    setOpponentPlayers([]);
    if (sched) setSelSparingId(sched.id);
  }

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  const sparingAtts = useMemo(() => attendances.filter((a) => a.scheduleId === selSparingId), [attendances, selSparingId]);
  const [selectedOurIds, setSelectedOurIds] = useState<string[]>([]);

  useEffect(() => {
    if (!selSparingId) return;
    setPendingNewMatches([]);
    setPendingCourt({});
    const sched = sparings.find((s) => s.id === selSparingId);
    const atts = attendances.filter((a) => a.scheduleId === selSparingId);
    const ids = atts.filter((a) => a.status === "hadir").map((a) => a.memberId);
    setSelectedOurIds(ids);
    setShowAddOur(false);
    setEditLogo(sched?.logoUrl || "");
    if (sched?.notes) {
      try {
        const saved = JSON.parse(sched.notes);
        if (saved.draftGames) setDraftGames(saved.draftGames);
        if (saved.matchesPerRound) setMatchesPerRound(saved.matchesPerRound);
        if (saved.totalRounds) setTotalRoundsSetting(saved.totalRounds);
        if (saved.courts) setLapanganList(saved.courts);
        if (saved.lokasi) setLokasi(saved.lokasi);
        if (saved.htm !== undefined) setHtm(saved.htm);
      } catch {}
    } else {
      setMatchesPerRound(10);
      setTotalRoundsSetting(1);
      setLapanganList([]);
      setLokasi("");
      setHtm(sched?.htm ?? 0);
    }
  }, [selSparingId]);

  function toggleOurMember(memberId: string) {
    setSelectedOurIds((prev) => prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]);
  }

  async function saveOurSelection() {
    if (!selSparingId) return;
    if (saving) return;
    setSaving(true);
    try {
      await fetch("/api/attendances/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: selSparingId,
          attendances: selectedOurIds.map((id) => ({ memberId: id, status: "hadir" })),
        }),
      });
      let opponentIds = selectedSparing ? getOpponentMemberIds(selectedSparing) : [];
      if (pendingOpponents.length > 0) {
        const created = await Promise.all(
          pendingOpponents.map((p) => addMember({ name: p.name, class: p.class, type: "2" }))
        );
        opponentIds = [...opponentIds, ...created.map((m) => m.id)];
      }
      const extra = selectedSparing ? JSON.parse(selectedSparing.notes || "{}") : {};
      await updateSchedule(selSparingId, { notes: JSON.stringify({ ...extra, opponentMemberIds: opponentIds, draftGames, matchesPerRound, totalRounds: totalRoundsSetting, courts: lapanganList, lokasi, htm }), htm: htm || null, logoUrl: editLogo || null });
      setPendingOpponents([]);
      toast("success", "Pengaturan sparing berhasil disimpan");
      setShowAddOur(false);
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const classOrder = ["A","B","C","D","E","F"];
  const byClass = (a: ApiMember, b: ApiMember) => (classOrder.indexOf(a.class || "Z") - classOrder.indexOf(b.class || "Z")) || a.name.localeCompare(b.name);

  const ourAvailable = useMemo(() => internalMembers.filter((m) => selectedOurIds.includes(m.id)).sort(byClass), [internalMembers, selectedOurIds]);
  const oppAvailable = useMemo(() => {
    if (!selectedSparing) return [];
    const ids = getOpponentMemberIds(selectedSparing);
    return externalMembers.filter((m) => ids.includes(m.id)).sort(byClass);
  }, [externalMembers, selectedSparing]);

  function toggleDraftSlot(side: "our" | "opp", memberId: string) {
    const [s1, s2, set1, set2] = side === "our"
      ? [draftOur1, draftOur2, setDraftOur1, setDraftOur2]
      : [draftOpp1, draftOpp2, setDraftOpp1, setDraftOpp2];
    if (s1 === memberId) { set1(""); return; }
    if (s2 === memberId) { set2(""); return; }
    if (!s1) { set1(memberId); } else if (!s2 && s1 !== memberId) { set2(memberId); }
  }

  function addLapangan() {
    if (!lapName.trim() || !lapStart || !lapEnd) return;
    const newCourt = { name: `Lap. ${lapName.trim()}`, startTime: lapStart, endTime: lapEnd };
    if (editLapIdx !== null) {
      const updated = [...lapanganList];
      updated[editLapIdx] = newCourt;
      setLapanganList(updated);
      setEditLapIdx(null);
    } else {
      setLapanganList([...lapanganList, newCourt]);
    }
    setLapName(""); setLapStart(""); setLapEnd(""); setShowAddLapangan(false);
  }

  function editLapangan(i: number) {
    setLapName(lapanganList[i].name);
    setLapStart(lapanganList[i].startTime);
    setLapEnd(lapanganList[i].endTime);
    setEditLapIdx(i);
    setShowAddLapangan(true);
  }

  function removeLapangan(i: number) {
    setLapanganList(lapanganList.filter((_, idx) => idx !== i));
    if (editLapIdx === i) { setEditLapIdx(null); setLapName(""); setShowAddLapangan(false); }
  }

  function createDraftMatch() {
    if (!selSparingId || !draftOur1 || !draftOur2 || !draftOpp1 || !draftOpp2) return;
    if (!members.find((m) => m.id === draftOur1) || !members.find((m) => m.id === draftOur2) ||
        !members.find((m) => m.id === draftOpp1) || !members.find((m) => m.id === draftOpp2)) return;
    const totalGames = draftGames.startsWith("2") ? 2 : 1;
    setPendingNewMatches((prev) => [...prev, { round: selectedRound, team1Player1Id: draftOur1, team1Player2Id: draftOur2, team2Player1Id: draftOpp1, team2Player2Id: draftOpp2, totalGames, notes: draftGames }]);
    setDraftOur1(""); setDraftOur2(""); setDraftOpp1(""); setDraftOpp2(""); setDraftGames("1-30");
  }

  async function saveDraft() {
    if (!selSparingId) return;
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      if (pendingNewMatches.length > 0) {
        const pbId = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
        const res = await fetch("/api/matches/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-pb-id": pbId },
          body: JSON.stringify({
            matches: pendingNewMatches.map((m) => ({
              scheduleId: selSparingId, totalGames: m.totalGames, round: m.round,
              team1Player1Id: m.team1Player1Id, team1Player2Id: m.team1Player2Id,
              team2Player1Id: m.team2Player1Id, team2Player2Id: m.team2Player2Id,
              courtNumber: null, scoreTeam1: null, scoreTeam2: null,
              scoreTeam1Game2: null, scoreTeam2Game2: null, winnerTeam: null, status: "planned", notes: m.notes,
            })),
          }),
        });
        if (!res.ok) throw new Error("Gagal simpan draft");
      }
      if (Object.keys(pendingCourt).length > 0) {
        await Promise.all(
          Object.entries(pendingCourt).map(([matchId, court]) => updateMatch(matchId, { courtNumber: court }))
        );
      }
      setPendingNewMatches([]);
      setPendingCourt({});
      toast("success", "Draft berhasil disimpan");
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setSavingDraft(false);
    }
  }

  function startEditMatch(m: ApiMatch) {
    setEditMatchId(m.id);
    setEditMatchOur1(m.team1Player1Id); setEditMatchOur2(m.team1Player2Id);
    setEditMatchOpp1(m.team2Player1Id); setEditMatchOpp2(m.team2Player2Id);
    setEditMatchMode(m.notes || "1-30");
  }

  async function saveEditMatch(id: string) {
    if (!editMatchOur1 || !editMatchOur2 || !editMatchOpp1 || !editMatchOpp2) return;
    const totalGames = editMatchMode.startsWith("2") ? 2 : 1;
    await updateMatch(id, {
      team1Player1Id: editMatchOur1, team1Player2Id: editMatchOur2,
      team2Player1Id: editMatchOpp1, team2Player2Id: editMatchOpp2,
      totalGames, notes: editMatchMode, round: selectedRound,
    });
    setEditMatchId(null);
  }

  function startEditPending(i: number) {
    const m = pendingNewMatches[i];
    if (!m) return;
    setEditPendingIdx(i);
    setEditMatchOur1(m.team1Player1Id); setEditMatchOur2(m.team1Player2Id);
    setEditMatchOpp1(m.team2Player1Id); setEditMatchOpp2(m.team2Player2Id);
    setEditMatchMode(m.notes || "1-30");
  }

  function saveEditPending(i: number) {
    if (!editMatchOur1 || !editMatchOur2 || !editMatchOpp1 || !editMatchOpp2) return;
    const totalGames = editMatchMode.startsWith("2") ? 2 : 1;
    setPendingNewMatches((prev) => prev.map((m, j) => j === i ? { ...m, team1Player1Id: editMatchOur1, team1Player2Id: editMatchOur2, team2Player1Id: editMatchOpp1, team2Player2Id: editMatchOpp2, totalGames, notes: editMatchMode } : m));
    setEditPendingIdx(null);
  }

  async function saveOppEdit(id: string) {
    if (!editOppName.trim() || !editOppClass) return;
    await updateMember(id, { name: editOppName.trim(), class: editOppClass });
    setEditOppId(null); setEditOppName(""); setEditOppClass("");
  }

  async function saveSparingName() {
    if (!selectedSparing || !editSparingName.trim()) return;
    await updateSchedule(selectedSparing.id, { sparingOpponent: editSparingName.trim(), title: `Sparing vs ${editSparingName.trim()}` });
    setIsEditingSparing(false);
    setEditSparingName("");
  }

  function addNewOpponent() {
    if (!newOppName.trim() || !newOppClass) return;
    setPendingOpponents((prev) => [...prev, { name: newOppName.trim(), class: newOppClass }]);
    setNewOppName(""); setNewOppClass(""); setShowAddOpp(false);
  }

  const opposePlayers = useMemo(() => {
    if (!selectedSparing) return [];
    const ids = getOpponentMemberIds(selectedSparing);
    return externalMembers.filter((m) => {
      if (!ids.includes(m.id)) return false;
      const schedMatchIds = sparingMatches.flatMap((m) => [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id]);
      return !schedMatchIds.includes(m.id);
    });
  }, [externalMembers, sparingMatches, selectedSparing]);

  return (
    <div className="mx-auto max-w-6xl">
      {!firstDataLoaded ? (
        <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
      ) : (<>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pbName || "Sparing"}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{sparings.length} sparing tersimpan</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedSparing && (
            <Link href="/sparing/match" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"><ExternalLink className="h-3.5 w-3.5" /> Match Controller</Link>
          )}
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)]">
          <Plus className="h-4 w-4" /> Sparing Baru
        </button>
        </div>
      </div>

      {sparings.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Swords className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada sparing</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sparings.map((s) => {
            const extCount = getOpponentMemberIds(s).length;
            const isCompleted = s.status === "completed";
            return (
              <div key={s.id} onClick={() => setSelSparingId(s.id)}
                className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${selSparingId === s.id ? "ring-2 ring-[var(--color-primary)]" : ""} ${isCompleted ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Swords className="h-4 w-4 text-[var(--color-primary)]" /> {pbName || "Sparing"} vs {s.sparingOpponent}
                  {isCompleted && <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Selesai</span>}
                </div>
                <p className="mt-1 text-xs text-gray-500">{new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                <p className="mt-2 text-xs text-gray-400">{matches.filter((m) => m.scheduleId === s.id).length} pertandingan</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Sparing Detail */}
      {selectedSparing && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Header with title and action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              {isEditingSparing ? (
                <div className="flex items-center gap-2">
                  <input value={editSparingName} onChange={(e) => setEditSparingName(e.target.value)} placeholder="Nama PB Lawan"
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                  <button onClick={saveSparingName} disabled={!editSparingName.trim()} className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Simpan</button>
                  <button onClick={() => { setIsEditingSparing(false); setEditSparingName(""); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{pbName || "Sparing"} vs {selectedSparing.sparingOpponent}</h2>
                    <p className="text-sm text-gray-500">{new Date(selectedSparing.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                  <button onClick={() => { setEditSparingName(selectedSparing.sparingOpponent || ""); setIsEditingSparing(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                </>
              )}
            </div>
            <button onClick={async () => { try { await updateSchedule(selectedSparing.id, { status: selectedSparing.status === "completed" ? "scheduled" : "completed" }); } catch {} }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-all ${
                selectedSparing.status === "completed"
                  ? "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}>
              <Check className="h-3.5 w-3.5" /> {selectedSparing.status === "completed" ? "Buka Lagi" : "Selesai"}
            </button>
          </div>

          {/* Tab bar */}
          <div className="mb-6 flex gap-1 border-b border-gray-200">
            <button onClick={() => setTab("pengaturan")} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === "pengaturan" ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]" : "text-gray-500 hover:text-gray-700"}`}>Pengaturan</button>
            <button onClick={() => setTab("draft")} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === "draft" ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]" : "text-gray-500 hover:text-gray-700"}`}>Draft Pertandingan</button>
          </div>

          {/* Tab content */}
          {tab === "pengaturan" && (
          <div>
          {/* Settings bar */}
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Mode Game</label>
              <select value={draftGames} onChange={(e) => setDraftGames(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                <option value="1-30">1 Game 30 Poin</option>
                <option value="1-42">1 Game 42 Poin</option>
                <option value="2-21">2 Game 21 Poin</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Jumlah Match</label>
              <input type="number" min={0} placeholder="0" value={matchesPerRound === 0 ? "" : matchesPerRound} onChange={(e) => setMatchesPerRound(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-sm text-center shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Jumlah Round</label>
              <input type="number" min={0} placeholder="0" value={totalRoundsSetting === 0 ? "" : totalRoundsSetting} onChange={(e) => setTotalRoundsSetting(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                className="w-14 rounded-xl border border-gray-200 px-3 py-2 text-sm text-center shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
          </div>

          {/* Logo Lawan */}
          <div className="mb-6 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Logo {selectedSparing?.sparingOpponent || "Lawan"}</h3>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white">
                {editLogo ? <img src={editLogo} alt="" className="h-full w-full object-contain" /> : <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
                <input type="file" accept="image/*" onChange={handleEditLogoUpload} className="hidden" />
              </label>
              {editLogo && <button onClick={() => setEditLogo("")} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
            </div>
          </div>

          {/* Daftar Lapangan */}
          <div className="mb-6 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Daftar Lapangan</h3>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-1">Lokasi</label>
              <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} placeholder="Nama tempat / alamat"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-1">HTM (Rp)</label>
              <input type="number" value={htm} onChange={(e) => setHtm(Math.max(0, Number(e.target.value)))} min={0} placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{lapanganList.length} lapangan</span>
              {!showAddLapangan && <button onClick={() => { setEditLapIdx(null); setLapName(""); setLapStart(""); setLapEnd(""); setShowAddLapangan(true); }} className="rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"><Plus className="h-3 w-3 inline" /> Tambah Lapangan</button>}
            </div>
            {showAddLapangan && (
              <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <input value={lapName} onChange={(e) => setLapName(e.target.value)} placeholder="A"
                  className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                <input type="time" value={lapStart} onChange={(e) => setLapStart(e.target.value)} placeholder="Mulai"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                <span className="self-center text-xs text-gray-400">—</span>
                <input type="time" value={lapEnd} onChange={(e) => setLapEnd(e.target.value)} placeholder="Selesai"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                <button onClick={addLapangan} disabled={!lapName.trim() || !lapStart || !lapEnd} className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{editLapIdx !== null ? "Simpan" : <Plus className="h-3.5 w-3.5" />}</button>
                <button onClick={() => { setShowAddLapangan(false); setEditLapIdx(null); setLapName(""); }} className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
            {lapanganList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lapanganList.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <span className="text-xs text-gray-400">{c.startTime.slice(0,5)}-{c.endTime.slice(0,5)}</span>
                    <button onClick={() => editLapangan(i)} className="text-gray-400 hover:text-blue-600"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => removeLapangan(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            ) : (
              !showAddLapangan && <p className="text-xs text-gray-400">Belum ada lapangan. Tambah lapangan untuk assign pertandingan.</p>
      )}
    </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Our Members */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">Pemain Kita <span className="text-xs font-normal text-gray-400">({selectedOurIds.length})</span></h3>
              <div className="mb-3 space-y-1">
                {[...selectedOurIds].sort((a, b) => {
                  const ma = members.find((x) => x.id === a);
                  const mb = members.find((x) => x.id === b);
                  if (!ma || !mb) return 0;
                  return (classOrder.indexOf(ma.class || "Z") - classOrder.indexOf(mb.class || "Z")) || ma.name.localeCompare(mb.name);
                }).map((id) => {
                  const m = members.find((x) => x.id === id);
                  if (!m) return null;

                  if (!schedulesLoaded || !membersLoaded || !matchesLoaded || !attendancesLoaded) return <LoadingSpinner />;

                  return (
                    <div key={m.id} className="rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>{m.name} <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${classBadge[m.class] || "bg-gray-100 text-gray-600"}`}>{m.class}</span></span>
                        <button onClick={() => toggleOurMember(m.id)} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
                {selectedOurIds.length === 0 && <p className="text-xs text-gray-400 py-2">Belum ada pemain dipilih</p>}
              </div>
              {/* Add our player */}
              {showAddOur ? (
                <div className="flex gap-2">
                  <select value="" onChange={(e) => { if (e.target.value) { toggleOurMember(e.target.value); } }}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                    <option value="">Pilih anggota...</option>
                    {[...internalMembers].filter((m) => !selectedOurIds.includes(m.id)).sort(byClass).map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.class})</option>
                    ))}
                  </select>
                  <button onClick={() => setShowAddOur(false)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => setShowAddOur(true)} className="w-full rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"><Plus className="h-3.5 w-3.5 inline" /> Tambah Anggota</button>
              )}
            </div>

            {/* Opponent Members */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">Pemain {selectedSparing.sparingOpponent}</h3>
              <div className="mb-3 space-y-1">
                {[...externalMembers.filter((m) => getOpponentMemberIds(selectedSparing).includes(m.id))].sort(byClass).map((m) => (
                  <div key={m.id} className="rounded-lg border border-gray-100 px-3 py-2 text-sm">
                    {editOppId === m.id ? (
                      <div className="flex gap-2">
                        <input value={editOppName} onChange={(e) => setEditOppName(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                        <select value={editOppClass} onChange={(e) => setEditOppClass(e.target.value)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-sm">
                          <option value="">—</option>
                          {["A","B","C","D","E","F"].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => saveOppEdit(m.id)} disabled={!editOppName.trim() || !editOppClass} className="rounded-lg bg-[var(--color-primary)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Simpan</button>
                        <button onClick={() => { setEditOppId(null); setEditOppName(""); setEditOppClass(""); }} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span>{m.name} <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${classBadge[m.class] || "bg-gray-100 text-gray-600"}`}>{m.class}</span></span>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditOppId(m.id); setEditOppName(m.name); setEditOppClass(m.class); }} className="text-gray-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removeMember(m.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {pendingOpponents.map((p, i) => (
                  <div key={`pending_${i}`} className="rounded-lg border border-dashed border-yellow-300 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{p.name} <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${classBadge[p.class] || "bg-gray-100 text-gray-600"}`}>{p.class}</span></span>
                      <button onClick={() => setPendingOpponents((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><XCircle className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Add new opponent player */}
              {showAddOpp ? (
                <div className="flex flex-wrap gap-2">
                  <input value={newOppName} onChange={(e) => setNewOppName(e.target.value)} placeholder="Nama pemain baru"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:flex-1 sm:w-auto" />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <select value={newOppClass} onChange={(e) => setNewOppClass(e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                      <option value="">—</option>
                      {["A","B","C","D","E","F"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={addNewOpponent} disabled={!newOppName.trim() || !newOppClass} className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50"><Plus className="h-4 w-4" /></button>
                    <button onClick={() => { setShowAddOpp(false); setNewOppName(""); setNewOppClass(""); }} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddOpp(true)} className="w-full rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"><Plus className="h-3.5 w-3.5 inline" /> Tambah Pemain</button>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-3">
              <button onClick={saveOurSelection} disabled={saving} className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Menyimpan..." : "Simpan Pengaturan"}</button>
            </div>
          </div>
          </div>
          )}

          {tab === "draft" && (
          <div>
            {/* Round selector - Step 1 */}
            <div className="mb-6 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-bg)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">1</div>
                <h3 className="text-sm font-bold text-gray-700">Pilih Round</h3>
              </div>
              <select value={selectedRound} onChange={(e) => { setSelectedRound(Number(e.target.value)); setDraftOur1(""); setDraftOur2(""); setDraftOpp1(""); setDraftOpp2(""); }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>Round {r}</option>
                ))}
              </select>
            </div>

            {/* Existing draft matches for selected round */}
            {roundMatches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">✓</div>
                  <h3 className="text-sm font-bold text-gray-700">Daftar Pertandingan Round {selectedRound}</h3>
                  <span className="text-xs text-gray-400">({roundMatches.length} match)</span>
                </div>
                <div className="space-y-2">
                  {roundMatches.map((m, i) => (
                    editMatchId === m.id ? (
                    <div key={m.id} className="rounded-lg border border-[var(--color-primary)] px-4 py-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 mb-2">
                        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:gap-1">
                          <select value={editMatchOur1} onChange={(e) => setEditMatchOur1(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Kita 1</option>
                            {ourAvailable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={editMatchOur2} onChange={(e) => setEditMatchOur2(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Kita 2</option>
                            {ourAvailable.filter((p) => p.id !== editMatchOur1).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:gap-1">
                          <select value={editMatchOpp1} onChange={(e) => setEditMatchOpp1(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Lawan 1</option>
                            {oppAvailable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={editMatchOpp2} onChange={(e) => setEditMatchOpp2(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Lawan 2</option>
                            {oppAvailable.filter((p) => p.id !== editMatchOpp1).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <select value={editMatchMode} onChange={(e) => setEditMatchMode(e.target.value)}
                            className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                            <option value="1-30">1 Game 30</option>
                            <option value="1-42">1 Game 42</option>
                            <option value="2-21">2 Game 21</option>
                          </select>
                          <button onClick={() => saveEditMatch(m.id)} disabled={!editMatchOur1 || !editMatchOur2 || !editMatchOpp1 || !editMatchOpp2}
                            className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Simpan</button>
                          <button onClick={() => setEditMatchId(null)} className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">Batal</button>
                        </div>
                      </div>
                    ) : (
                    <div key={m.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3 sm:items-center">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-800 break-words">{getName(m.team1Player1Id)} <span className="text-gray-400 font-normal">&</span> {getName(m.team1Player2Id)}</div>
                          <div className="mt-0.5 text-xs text-gray-400">vs</div>
                          <div className="font-semibold text-gray-800 break-words">{getName(m.team2Player1Id) || "—"} <span className="text-gray-400 font-normal">&</span> {getName(m.team2Player2Id || "") || "—"}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-10 sm:shrink-0 sm:pl-0">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{m.totalGames} game</span>
                        {lapanganList.length > 0 && (
                          <>
                          <select value={pendingCourt[m.id] !== undefined ? (pendingCourt[m.id] || "") : (m.courtNumber || "")} onChange={(e) => { const v = e.target.value; setPendingCourt((prev) => ({ ...prev, [m.id]: v ? Number(v) : null })); }}
                            className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                            <option value="">Lapangan</option>
                            {lapanganList.map((c, ci) => <option key={ci} value={ci+1}>{c.name}</option>)}
                          </select>
                          {(pendingCourt[m.id] !== undefined ? pendingCourt[m.id] : m.courtNumber) && (
                            <button onClick={() => setPendingCourt((prev) => ({ ...prev, [m.id]: null }))} className="text-red-400 hover:text-red-600" title="Lepas dari lapangan"><XCircle className="h-3.5 w-3.5" /></button>
                          )}
                          </>
                        )}
                        {!m.courtNumber && <button onClick={() => startEditMatch(m)} className="text-gray-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>}
                        {!m.courtNumber && <button onClick={() => removeMatch(m.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Pending new matches */}
            {pendingNewMatches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-200 text-xs font-bold text-yellow-700">⏳</div>
                  <h3 className="text-sm font-bold text-gray-700">Menunggu Disimpan ({pendingNewMatches.length})</h3>
                </div>
                <div className="space-y-2">
                  {pendingNewMatches.map((m, i) => (
                    editPendingIdx === i ? (
                    <div key={i} className="rounded-lg border border-[var(--color-primary)] px-4 py-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 mb-2">
                        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:gap-1">
                          <select value={editMatchOur1} onChange={(e) => setEditMatchOur1(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Kita 1</option>
                            {ourAvailable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={editMatchOur2} onChange={(e) => setEditMatchOur2(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Kita 2</option>
                            {ourAvailable.filter((p) => p.id !== editMatchOur1).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:gap-1">
                          <select value={editMatchOpp1} onChange={(e) => setEditMatchOpp1(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Lawan 1</option>
                            {oppAvailable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={editMatchOpp2} onChange={(e) => setEditMatchOpp2(e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                            <option value="">Lawan 2</option>
                            {oppAvailable.filter((p) => p.id !== editMatchOpp1).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      </div>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => saveEditPending(i)} disabled={!editMatchOur1 || !editMatchOur2 || !editMatchOpp1 || !editMatchOpp2}
                            className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Simpan</button>
                          <button onClick={() => setEditPendingIdx(null)} className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">Batal</button>
                        </div>
                      </div>
                    ) : (
                    <div key={i} className="flex flex-col gap-3 rounded-lg border border-dashed border-yellow-300 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3 sm:items-center">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-xs font-bold text-yellow-700">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-800 break-words">{getName(m.team1Player1Id)} <span className="text-gray-400 font-normal">&</span> {getName(m.team1Player2Id)}</div>
                          <div className="mt-0.5 text-xs text-gray-400">vs</div>
                          <div className="font-semibold text-gray-800 break-words">{getName(m.team2Player1Id) || "—"} <span className="text-gray-400 font-normal">&</span> {getName(m.team2Player2Id || "") || "—"}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-10 sm:shrink-0 sm:pl-0">
                        <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Round {m.round}</span>
                        <button onClick={() => startEditPending(i)} className="text-gray-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setPendingNewMatches((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><XCircle className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Create new match - Step 2 */}
            <div className="rounded-xl border-2 border-dashed border-gray-300 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">2</div>
                <h3 className="text-sm font-bold text-gray-700">Pilih Pemain — Round {selectedRound}</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Our Team */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Pemain Kita</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                      <select value={draftOur1} onChange={(e) => setDraftOur1(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                        <option value="">—</option>
                        {ourAvailable.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.class})</option>
                        ))}
                      </select>
                      <select value={draftOur2} onChange={(e) => setDraftOur2(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                        <option value="">—</option>
                        {ourAvailable.filter((m) => m.id !== draftOur1).map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.class})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Opponent Team */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Pemain {selectedSparing.sparingOpponent}</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                      <select value={draftOpp1} onChange={(e) => setDraftOpp1(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                        <option value="">—</option>
                        {oppAvailable.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.class})</option>
                        ))}
                      </select>
                      <select value={draftOpp2} onChange={(e) => setDraftOpp2(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-1/2">
                        <option value="">—</option>
                        {oppAvailable.filter((m) => m.id !== draftOpp1).map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.class})</option>
                        ))}
                      </select>
                    </div>
                  </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <span className="text-xs text-gray-500">Mode: {modeLabel[draftGames]}</span>
                <button onClick={createDraftMatch} disabled={!draftOur1 || !draftOur2 || !draftOpp1 || !draftOpp2}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Plus className="h-3.5 w-3.5 inline" /> Tambah</button>
                <button onClick={saveDraft} disabled={savingDraft || (pendingNewMatches.length === 0 && Object.keys(pendingCourt).length === 0)}
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{savingDraft ? "Menyimpan..." : "Simpan Draft"}</button>
              </div>
            </div>
          </div>
          )}

        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Sparing Baru</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nama PB Lawan</label>
                  <div className="mt-1.5 flex gap-2">
                    <input value={formOpponent} onChange={(e) => setFormOpponent(e.target.value)} placeholder="PB ..."
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700">
                      {formLogo ? <img src={formLogo} alt="" className="h-6 w-6 rounded object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                      <input type="file" accept="image/*" onChange={handleFormLogoUpload} className="hidden" />
                      {formLogo && <button onClick={(e) => { e.preventDefault(); setFormLogo(""); }} className="ml-1 text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                    </label>
                  </div>
                </div>
              </div>

              {/* Add opponent players */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pemain Lawan</label>
                <div className="flex gap-2 mb-2">
                  <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Nama"
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
                  <select value={playerClass} onChange={(e) => setPlayerClass(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10">
                    <option value="">—</option>
                    {["A","B","C","D","E","F"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={addPlayer} disabled={!playerName.trim() || !playerClass} className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{editPlayerIdx !== null ? "Simpan" : <Plus className="h-4 w-4" />}</button>
                  {editPlayerIdx !== null && <button onClick={() => { setEditPlayerIdx(null); setPlayerName(""); setPlayerClass(""); }} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><X className="h-4 w-4" /></button>}
                </div>
                {opponentPlayers.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {opponentPlayers.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <span>{p.name} <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${classBadge[p.class] || "bg-gray-100 text-gray-600"}`}>{p.class}</span></span>
                        <div className="flex gap-1">
                          <button onClick={() => editPlayer(i)} className="text-gray-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removePlayer(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowCreate(false); setFormLogo(""); }} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                <button onClick={handleCreate} disabled={!formOpponent.trim()}
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">Simpan Sparing</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}


