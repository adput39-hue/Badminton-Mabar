"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, CalendarDays, UserCheck, Search } from "lucide-react";
import type { ApiSchedule, ApiMember, ApiAttendance } from "@/lib/api-types";

export default function AbsenPage() {
  const [pbId, setPbId] = useState("");
  const [reading, setReading] = useState(true);
  const [schedules, setSchedules] = useState<ApiSchedule[]>([]);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [attendances, setAttendances] = useState<ApiAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selSched, setSelSched] = useState("");
  const [savingId, setSavingId] = useState("");
  const [doneId, setDoneId] = useState("");
  const [pbName, setPbName] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [confirmMember, setConfirmMember] = useState<ApiMember | null>(null);
  const [thanksOpen, setThanksOpen] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get("pb") || q.get("pbId") || "";
    setPbId(p);
    setReading(false);
  }, []);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!pbId) return;
    fetch("/api/pbs")
      .then((r) => r.json())
      .then((list: { id: string; name: string }[]) => {
        const pb = list.find((x) => x.id === pbId);
        if (pb) setPbName(pb.name);
      })
      .catch(() => {});
  }, [pbId]);

  useEffect(() => {
    if (!pbId) return;
    let cancelled = false;
    (async () => {
      try {
        const [sRes, mRes, aRes] = await Promise.all([
          fetch(`/api/schedules?pbId=${encodeURIComponent(pbId)}`),
          fetch(`/api/members?pbId=${encodeURIComponent(pbId)}`),
          fetch("/api/attendances"),
        ]);
        const scheds = await sRes.json() as ApiSchedule[];
        const mems = await mRes.json() as ApiMember[];
        const atts = await aRes.json() as ApiAttendance[];
        if (cancelled) return;
        setSchedules(scheds);
        setMembers(mems);
        setAttendances(atts);
        const todayScheds = scheds.filter((s) => s.date.split("T")[0] === today && s.status !== "cancelled");
        if (todayScheds.length === 1) setSelSched(todayScheds[0].id);
      } catch {
        if (!cancelled) setError("Gagal memuat data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pbId, today]);

  const todaySchedules = useMemo(
    () => schedules.filter((s) => s.date.split("T")[0] === today && s.status !== "cancelled"),
    [schedules, today]
  );

  useEffect(() => {
    const pb = schedules.find((s) => s.pbId === pbId);
    if (pb) setPbName(pb.title.split(" ")[0] || "");
  }, [schedules, pbId]);

  const selected = todaySchedules.find((s) => s.id === selSched);

  const participants = useMemo(() => {
    if (!selected) return [];
    return attendances
      .filter((a) => a.scheduleId === selected.id)
      .map((a) => {
        const m = members.find((x) => x.id === a.memberId);
        return { att: a, member: m };
      })
      .filter((x) => x.member);
  }, [selected, attendances, members]);

  const confirmedIds = useMemo(
    () => new Set(participants.filter((p) => p.att.status === "hadir").map((p) => p.att.memberId)),
    [participants]
  );

  const filteredParticipants = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(({ member }) =>
      member!.name.toLowerCase().includes(q) ||
      member!.class.toLowerCase().includes(q)
    );
  }, [participants, searchQ]);

  function handleTapName(member: ApiMember) {
    setError("");
    setConfirmMember(member);
  }

  async function confirmHadir() {
    if (!selected || !confirmMember) return;
    const memberId = confirmMember.id;
    setConfirmMember(null);
    if (confirmedIds.has(memberId)) {
      setError("Nama ini sudah absen hadir.");
      return;
    }
    setSavingId(memberId);
    setError("");
    try {
      const existing = participants.find((p) => p.member!.id === memberId)?.att;
      if (existing) {
        const res = await fetch(`/api/attendances/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "hadir", confirmedAt: new Date().toISOString() }),
        });
        if (!res.ok) throw new Error("gagal update");
      } else {
        const res = await fetch("/api/attendances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: selected.id, memberId, status: "hadir", confirmedAt: new Date().toISOString() }),
        });
        if (!res.ok) throw new Error("gagal tambah");
      }
      const aRes = await fetch("/api/attendances");
      setAttendances(await aRes.json());
      setDoneId(memberId);
      setTimeout(() => setDoneId(""), 1500);
      setThanksOpen(true);
    } catch {
      setError("Gagal menandai hadir. Coba lagi.");
    } finally {
      setSavingId("");
    }
  }

  if (reading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!pbId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <CalendarDays className="mx-auto h-10 w-10 text-gray-300" />
          <h1 className="mt-3 text-lg font-bold text-gray-900">Absen Mabar</h1>
          <p className="mt-1 text-sm text-gray-500">QR tidak valid. Hubungi admin PB.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-8 pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-lg px-4 text-center">
          <h1 className="text-xl font-bold text-white sm:text-2xl">Absen Mabar</h1>
          <p className="mt-1 text-sm font-medium text-white/70">{pbName || "PB"} · {new Date(today).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>

      <div className="relative mx-auto max-w-lg px-4 py-5">
        {todaySchedules.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
            <CalendarDays className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Tidak ada jadwal mabar hari ini</p>
          </div>
        ) : (
          <>
            {todaySchedules.length > 1 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pilih Jadwal</p>
                {todaySchedules.map((s) => (
                  <button key={s.id} onClick={() => setSelSched(s.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all ${selSched === s.id ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] font-semibold text-[var(--color-primary)]" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
                    <span>{s.title}</span>
                    {s.startTime && <span className="text-xs text-gray-400">{s.startTime.slice(0,5)}</span>}
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <h2 className="text-base font-bold text-gray-900">{selected.title}</h2>
                  <p className="mt-0.5 text-xs text-gray-400">{selected.location || ""} {selected.startTime ? `· ${selected.startTime.slice(0,5)}` : ""}</p>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <span className="text-xs font-medium text-gray-500">Ketuk namamu untuk absen hadir</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-primary)]">
                    <UserCheck className="h-3 w-3" /> {confirmedIds.size} hadir
                  </span>
                </div>
                <div className="border-b border-gray-100 p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="Cari nama atau kelas..."
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-[45vh] space-y-1 overflow-y-auto p-3">
                  {filteredParticipants.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">{participants.length === 0 ? "Belum ada peserta terdaftar" : "Tidak ditemukan"}</p>
                  ) : (
                    filteredParticipants.map(({ member }) => {
                      const isDone = doneId === member!.id;
                      const isSaving = savingId === member!.id;
                      const isConfirmed = confirmedIds.has(member!.id);
                      return (
                        <button key={member!.id} onClick={() => handleTapName(member!)} disabled={isSaving}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${isConfirmed ? "bg-[var(--color-primary-light)]" : "bg-gray-50 hover:bg-[var(--color-primary-light)]"} disabled:opacity-60`}>
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isConfirmed ? "bg-[var(--color-primary)] text-white" : "bg-white text-[var(--color-primary)] shadow-sm"}`}>{member!.name[0]}</span>
                          <span className="flex-1">
                            <span className="block text-sm font-medium text-gray-900">{member!.name}</span>
                            <span className="block text-xs text-gray-400">Kelas {member!.class}</span>
                          </span>
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
                            : isDone ? <Check className="h-5 w-5 text-green-600" />
                            : isConfirmed ? <Check className="h-5 w-5 text-[var(--color-primary)]" /> : null}
                        </button>
                      );
                    })
                  )}
                </div>
                {error && <p className="border-t border-gray-100 px-5 py-3 text-center text-xs text-red-500">{error}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {confirmMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${confirmedIds.has(confirmMember.id) ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary)]"}`}>{confirmMember.name[0]}</span>
            <h2 className="mt-3 text-base font-bold text-gray-900">{confirmMember.name}</h2>
            <p className="text-xs text-gray-400">Kelas {confirmMember.class}</p>
            {confirmedIds.has(confirmMember.id) ? (
              <p className="mt-4 text-sm text-gray-600">Nama ini sudah absen hadir.</p>
            ) : (
              <p className="mt-4 text-sm text-gray-600">Apakah ini benar namanya?</p>
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmMember(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Tidak
              </button>
              {!confirmedIds.has(confirmMember.id) && (
                <button onClick={confirmHadir}
                  className="flex-1 rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">
                  Ya
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {thanksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </span>
            <h2 className="mt-3 text-base font-bold text-gray-900">Terima kasih</h2>
            <p className="mt-2 text-sm text-gray-600">Data sudah benar, data absen akan diupdate.</p>
            <button onClick={() => setThanksOpen(false)}
              className="mt-5 w-full rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
