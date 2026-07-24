"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { useApi } from "@/lib/api-store";
import type { ApiSchedule as Schedule, ApiAttendance as Attendance, ApiMember as Member } from "@/lib/api-types";
import { Plus, X, Calendar, MapPin, Users, Clock, CheckCircle2, Circle, XCircle, UserPlus, Grid3X3, DollarSign } from "lucide-react";
import { toTitleCase } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  planned: "bg-amber-50 text-amber-700 border-amber-200",
  ongoing: "bg-[#ccfbf1] text-[#0d9488] border-[#99f6e4]",
  completed: "bg-gray-100 text-gray-500 border-gray-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

const dayNames = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];
const monthNames = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OKT", "NOV", "DES"];

function getDateBadge(dateStr: string) {
  const d = new Date(dateStr);
  return { day: dayNames[d.getDay()], date: d.getDate(), month: monthNames[d.getMonth()] };
}

function getDayLabel(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return dayNames[d.getDay()];
}

export default function SchedulesPage() {
  const { items: schedules, add: addSchedule, update: updateSchedule, remove: removeSchedule } = useApi<Schedule>("schedules");
  const { items: members } = useApi<Member>("members");
  const { items: attendances, add: addAtt, update: updateAtt, remove: removeAtt } = useApi<Attendance>("attendances");
  const [showForm, setShowForm] = useState(false);
  const [showAtt, setShowAtt] = useState<string | null>(null);
  const [showPeserta, setShowPeserta] = useState<string | null>(null);
  const [showTambahLap, setShowTambahLap] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCourtIdx, setEditCourtIdx] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", date: "", location: "", max_participants: "", htm: "", notes: "" });
  const [courtsList, setCourtsList] = useState<{name: string; startTime: string; endTime: string}[]>([]);
  const [courtInput, setCourtInput] = useState({ name: "", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const existingLocations = [...new Set(schedules.map((s) => s.location).filter(Boolean))] as string[];
  const usedSchedules = new Set(attendances.filter((a) => a.status !== "undangan").map((a) => a.scheduleId));

  function openAdd() { setEditId(null); setForm({ title: "", date: "", location: "", max_participants: "", htm: "", notes: "" }); setCourtsList([]); setCourtInput({ name: "", startTime: "", endTime: "" }); setShowForm(true); }

  function openEdit(s: Schedule) {
    setEditId(s.id);
    setForm({ title: s.title, date: s.date.split("T")[0], location: s.location || "", max_participants: String(s.maxParticipants || ""), htm: String(s.htm ?? ""), notes: s.notes || "" });
    try { setCourtsList(s.courts ? JSON.parse(s.courts) : []); } catch { setCourtsList([]); }
    setCourtInput({ name: "", startTime: "", endTime: "" });
    setShowForm(true);
  }

  function addCourt() {
    if (!courtInput.name.trim() || !courtInput.startTime || !courtInput.endTime) return;
    const prefix = courtInput.name.trim().match(/^L\./i) ? "" : "L.";
    setCourtsList([...courtsList, { name: prefix + courtInput.name.trim(), startTime: courtInput.startTime, endTime: courtInput.endTime }]);
    setCourtInput({ name: "", startTime: "", endTime: "" });
  }

  function removeCourt(idx: number) { setCourtsList(courtsList.filter((_, i) => i !== idx)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const payload = { title: form.title.trim(), date: form.date, location: form.location || null, maxParticipants: Number(form.max_participants) || 20, htm: form.htm === "" ? null : Number(form.htm), courts: courtsList.length > 0 ? JSON.stringify(courtsList) : null, notes: form.notes || null };
      if (editId) await updateSchedule(editId, payload);
      else await addSchedule(payload);
      toast("success", editId ? "Jadwal berhasil diperbarui" : "Jadwal berhasil dibuat");
      setShowForm(false);
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, s: Schedule["status"]) { await updateSchedule(id, { status: s }); }

  async function handleSelectParticipants(scheduleId: string, selectedIds: string[]) {
    const currentAtts = attendances.filter((a) => a.scheduleId === scheduleId);
    const currentIds = currentAtts.map((a) => a.memberId);
    const toAdd = selectedIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentAtts.filter((a) => !selectedIds.includes(a.memberId));
    for (const memberId of toAdd) await addAtt({ scheduleId, memberId, status: "undangan" });
    for (const att of toRemove) await removeAtt(att.id);
    setShowPeserta(null);
  }

  async function handleAttendance(scheduleId: string, memberId: string, status: Attendance["status"]) {
    const att = attendances.find((a) => a.scheduleId === scheduleId && a.memberId === memberId);
    if (att) await updateAtt(att.id, { status, confirmedAt: new Date().toISOString() });
    else await addAtt({ scheduleId, memberId, status, confirmedAt: new Date().toISOString() });
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = schedules.filter((s) => new Date(s.date).toISOString().split("T")[0] >= today && s.status !== "cancelled");
  const past = schedules.filter((s) => new Date(s.date).toISOString().split("T")[0] < today || s.status === "completed" || s.status === "cancelled");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jadwal Mabar</h1>
          <p className="mt-0.5 text-sm text-gray-500">{upcoming.length} jadwal mendatang</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md"><Plus className="h-4 w-4" /> Buat Jadwal</button>
      </div>

      {schedules.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Calendar className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada jadwal</p>
          <button onClick={openAdd} className="mt-3 text-sm font-medium text-[#0d9488] hover:underline">Buat jadwal baru</button>
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.map((s) => (
            <ScheduleCard key={s.id} schedule={s} onStatus={setStatus} onDelete={removeSchedule}
              pesertaCount={attendances.filter((a) => a.scheduleId === s.id).length}
              hadirCount={attendances.filter((a) => a.scheduleId === s.id && a.status === "hadir").length}
              onPilihPeserta={() => setShowPeserta(s.id)}
              onAttend={() => setShowAtt(s.id)}
              onEdit={() => openEdit(s)} isUsed={usedSchedules.has(s.id)} />
          ))}
          {past.length > 0 && <h2 className="pt-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Riwayat</h2>}
          {past.map((s) => (
            <ScheduleCard key={s.id} schedule={s} onStatus={setStatus} onDelete={removeSchedule}
              pesertaCount={attendances.filter((a) => a.scheduleId === s.id).length}
              hadirCount={attendances.filter((a) => a.scheduleId === s.id && a.status === "hadir").length}
              onPilihPeserta={() => setShowPeserta(s.id)}
              onAttend={() => setShowAtt(s.id)}
              onEdit={() => openEdit(s)} isUsed={usedSchedules.has(s.id)} />
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Jadwal" : "Buat Jadwal Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700">Judul</label><input value={form.title} onChange={(e) => setForm({ ...form, title: toTitleCase(e.target.value) })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Mabar Senin" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <div className="relative mt-1.5">
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
                    {form.date && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-[#ccfbf1] px-2 py-0.5 text-xs font-bold text-[#0d9488]">
                        {getDayLabel(form.date)}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lokasi</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: toTitleCase(e.target.value) })} list="location-list" className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="GOR ABC" />
                  <datalist id="location-list">
                    {existingLocations.map((loc) => <option key={loc} value={loc} />)}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">Max Peserta</label><input type="number" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: e.target.value })} min={2} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="0" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700">HTM (Rp)</label><input type="number" value={form.htm} onChange={(e) => setForm({ ...form, htm: e.target.value })} min={0} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="0" /></div>
              </div>

              {/* Lapangan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Lapangan</label>
                {courtsList.length > 0 && (
                  <div className="mb-3 max-h-[180px] space-y-2 overflow-y-auto">
                    {courtsList.map((c, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-xs font-bold text-white">{c.name}</span>
                          <span className="text-sm font-medium text-gray-700">{c.startTime.slice(0,5)} - {c.endTime.slice(0,5)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {editId && usedSchedules.has(editId) ? (
                            <button type="button" onClick={() => { setCourtInput({ name: c.name, startTime: c.startTime, endTime: c.endTime }); setEditCourtIdx(i); setShowTambahLap(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          ) : (
                            <button type="button" onClick={() => removeCourt(i)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => { setCourtInput({ name: "", startTime: "", endTime: "" }); setEditCourtIdx(null); setShowTambahLap(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 transition-all hover:border-[#0d9488] hover:text-[#0d9488]">
                  <Plus className="h-4 w-4" /> Tambah Lapangan
                </button>
              </div>
              <div><label className="block text-sm font-medium text-gray-700">Catatan</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: toTitleCase(e.target.value) })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" rows={2} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Menyimpan..." : (editId ? "Simpan" : "Buat")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Lapangan */}
      {showTambahLap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">{editCourtIdx !== null ? "Edit Lapangan" : "Tambah Lapangan"}</h3>
              <button onClick={() => setShowTambahLap(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Nama (angka/huruf)</label>
                <input value={editCourtIdx !== null ? courtInput.name.replace(/^L\./i, "") : courtInput.name}
                  onChange={(e) => setCourtInput({ ...courtInput, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="1, A" />
                {courtInput.name.trim() && (
                  <p className="mt-1 text-xs text-[#0d9488] font-medium">Preview: L.{courtInput.name.trim().replace(/^L\./i, "")}</p>
                )}
              </div>
              {editCourtIdx === null && (
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-medium text-gray-700">Jam Mulai</label><input type="time" value={courtInput.startTime} onChange={(e) => setCourtInput({ ...courtInput, startTime: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
                  <div><label className="block text-xs font-medium text-gray-700">Jam Selesai</label><input type="time" value={courtInput.endTime} onChange={(e) => setCourtInput({ ...courtInput, endTime: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTambahLap(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="button" disabled={editCourtIdx === null && (!courtInput.startTime || !courtInput.endTime)}
                  onClick={() => {
                    if (editCourtIdx !== null) {
                      const updated = [...courtsList];
                      updated[editCourtIdx] = { ...updated[editCourtIdx], name: courtInput.name.match(/^L\./i) ? courtInput.name : "L." + courtInput.name };
                      setCourtsList(updated);
                    } else { addCourt(); }
                    setShowTambahLap(false);
                  }}
                  className="rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-40">{editCourtIdx !== null ? "Simpan" : "Tambah"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPeserta && (
        <SelectParticipantsModal
          scheduleId={showPeserta}
          members={members}
          selectedIds={attendances.filter((a) => a.scheduleId === showPeserta).map((a) => a.memberId)}
          onSave={(ids) => handleSelectParticipants(showPeserta, ids)}
          onClose={() => setShowPeserta(null)} />
      )}

      {showAtt && (
        <AttendanceModal
          scheduleId={showAtt}
          members={members}
          attendances={attendances.filter((a) => a.scheduleId === showAtt)}
          onChangeStatus={(memberId, status) => handleAttendance(showAtt, memberId, status)}
          onClose={() => setShowAtt(null)} />
      )}
    </div>
  );
}

function ScheduleCard({ schedule, onStatus, onDelete, pesertaCount, hadirCount, onPilihPeserta, onAttend, onEdit, isUsed }: {
  schedule: Schedule; onStatus: (id: string, s: Schedule["status"]) => void; onDelete: (id: string) => void;
  pesertaCount: number; hadirCount: number; onPilihPeserta: () => void; onAttend: () => void; onEdit: () => void; isUsed: boolean;
}) {
  const d = new Date(schedule.date).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const isUpcoming = d >= today;
  const badge = getDateBadge(schedule.date);
  const progress = Math.round((hadirCount / schedule.maxParticipants) * 100);
  const full = hadirCount >= schedule.maxParticipants;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-[#0d9488] text-white">
            <span className="text-[10px] font-bold">{badge.day}</span>
            <span className="text-lg font-bold leading-none">{badge.date}</span>
            <span className="text-[9px]">{badge.month}</span>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900 sm:text-lg">{schedule.title}</h3>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle[schedule.status]}`}>{schedule.status === "planned" ? "Akan Datang" : schedule.status === "ongoing" ? "Berlangsung" : schedule.status === "completed" ? "Selesai" : "Dibatalkan"}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
              {schedule.startTime && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{schedule.startTime.slice(0, 5)} - {schedule.endTime?.slice(0,5) || ""}</span>}
              {schedule.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{schedule.location}</span>}
              {schedule.htm ? <span className="inline-flex items-center gap-1.5 font-medium text-[#0d9488]"><DollarSign className="h-3.5 w-3.5" />Rp {schedule.htm.toLocaleString("id-ID")}</span> : null}
              {schedule.courts && (() => { try {
                const courts = JSON.parse(schedule.courts) as {name:string;startTime:string;endTime:string}[];
                return courts.length > 0 && <span className="inline-flex items-center gap-1.5"><Grid3X3 className="h-3.5 w-3.5" />{courts.map(c => `${c.name} (${c.startTime.slice(0,5)}-${c.endTime.slice(0,5)})`).join(", ")}</span>;
              } catch { return null; }})()}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full transition-all ${full ? "bg-amber-500" : "bg-[#0d9488]"}`} style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <span className="whitespace-nowrap text-xs text-gray-500">{hadirCount}/{schedule.maxParticipants} {full ? "Penuh" : "Terisi"}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">{pesertaCount} peserta terdaftar</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {schedule.status !== "cancelled" && <button onClick={onEdit} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm">Edit</button>}
          <button onClick={onPilihPeserta} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm"><UserPlus className="h-3.5 w-3.5" />Pilih Peserta</button>
          <button onClick={onAttend} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm">Absen</button>
          {isUpcoming && schedule.status === "planned" && <>
            <button onClick={() => onStatus(schedule.id, "ongoing")} className="rounded-xl bg-[#ccfbf1] px-4 py-2 text-xs font-medium text-[#0d9488] transition-all hover:bg-[#99f6e4] hover:shadow-sm">Mulai</button>
            <button onClick={() => onStatus(schedule.id, "cancelled")} className="rounded-xl bg-red-50 px-4 py-2 text-xs font-medium text-red-600 transition-all hover:bg-red-100">Batal</button>
          </>}
          {schedule.status === "ongoing" && <button onClick={() => onStatus(schedule.id, "completed")} className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-gray-700 hover:shadow-sm">Selesai</button>}
          {schedule.status !== "cancelled" && (isUsed ? <span className="rounded-xl p-2 text-gray-300 cursor-not-allowed" title="Jadwal sudah digunakan"><X className="h-4 w-4" /></span> : <button onClick={() => onDelete(schedule.id)} className="rounded-xl p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>)}
        </div>
      </div>
    </div>
  );
}

function SelectParticipantsModal({ members, selectedIds, onSave, onClose }: {
  scheduleId: string; members: Member[]; selectedIds: string[];
  onSave: (selectedIds: string[]) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [focused, setFocused] = useState(false);

  const internal = members.filter((m) => m.type === "1" || !m.type);

  const filtered = internal.filter((m) => {
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.class.toLowerCase().includes(q);
  });

  function toggleMember(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
    setSearch("");
  }

  function removeMember(id: string) {
    setSelected(selected.filter((s) => s !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Pilih Peserta</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-4">
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Cari nama anggota..." className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
            {search && focused && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {filtered.map((m) => {
                  const isSel = selected.includes(m.id);
                  return (
                    <button key={m.id} type="button" onMouseDown={(e) => { e.preventDefault(); toggleMember(m.id); }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[#ccfbf1] ${isSel ? "bg-[#ccfbf1]/50 text-[#0d9488]" : "text-gray-700"}`}>
                      <div className={`flex h-4 w-4 items-center justify-center rounded border-2 ${isSel ? "border-[#0d9488] bg-[#0d9488]" : "border-gray-300"}`}>
                        {isSel && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span>{m.name}</span>
                      <span className="ml-auto text-xs text-gray-400">Kelas {m.class}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Tidak ditemukan</p>}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 pb-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Terpilih ({selected.length})</h4>
          {selected.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Belum ada peserta dipilih</p>
          ) : (
            <div className="max-h-[260px] space-y-1 overflow-y-auto">
              {selected.map((id) => {
                const m = members.find((x) => x.id === id);
                if (!m) return null;
                return (
                  <div key={id} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ccfbf1] text-xs font-bold text-[#0d9488]">{m.name.charAt(0)}</div>
                      <span className="text-sm font-medium text-gray-900">{m.name}</span>
                    </div>
                    <button type="button" onClick={() => removeMember(id)} className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <p className="text-sm text-gray-500">{selected.length} peserta</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
            <button onClick={() => onSave(selected)} className="rounded-xl bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] hover:shadow-md">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceModal({ scheduleId: _scheduleId, members, attendances, onChangeStatus, onClose }: {
  scheduleId: string; members: Member[]; attendances: Attendance[];
  onChangeStatus: (memberId: string, status: Attendance["status"]) => void; onClose: () => void;
}) {
  const pesertaAtts = attendances.filter((a) => a.status !== "tidak_jadi" || true);
  const hadir = attendances.filter((a) => a.status === "hadir").length;
  const tidakJadi = attendances.filter((a) => a.status === "tidak_jadi").length;
  const belum = attendances.filter((a) => a.status === "undangan").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Absensi</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-4 border-b border-gray-100 px-6 py-3 text-sm">
          <span className="font-medium text-[#0d9488]">✅ Hadir {hadir}</span>
          <span className="font-medium text-red-500">❌ Tidak Jadi {tidakJadi}</span>
          <span className="font-medium text-gray-400">⏳ Belum {belum}</span>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-4">
          {attendances.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Belum ada peserta. Pilih peserta dulu.</p>
          ) : attendances.map((att) => {
            const m = members.find((x) => x.id === att.memberId);
            if (!m) return null;
            return (
              <div key={att.id} className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-900">{m.name}</span>
                <div className="flex gap-1">
                  {(["hadir", "tidak_jadi", "undangan"] as Attendance["status"][]).map((s) => (
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
