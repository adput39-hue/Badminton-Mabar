"use client";

import { useState, useRef, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMember as Member, ApiAttendance, ApiMatch, ApiMatchHistory } from "@/lib/api-types";
import { Plus, Pencil, Trash2, X, Search, UserCheck, UserX, Camera, MapPin } from "lucide-react";
import { toTitleCase } from "@/lib/utils";

type MemberClass = "A" | "B" | "C" | "D" | "E" | "F";
const CLASSES: MemberClass[] = ["A", "B", "C", "D", "E", "F"];

const classColors: Record<MemberClass, string> = {
  A: "bg-gradient-to-br from-red-500 to-red-600", B: "bg-gradient-to-br from-orange-500 to-orange-600",
  C: "bg-gradient-to-br from-amber-500 to-amber-600", D: "bg-gradient-to-br from-green-500 to-green-600",
  E: "bg-gradient-to-br from-blue-500 to-blue-600", F: "bg-gradient-to-br from-purple-500 to-purple-600",
};

const classBadge: Record<MemberClass, string> = {
  A: "bg-red-100 text-red-700", B: "bg-orange-100 text-orange-700",
  C: "bg-amber-100 text-amber-700", D: "bg-green-100 text-green-700",
  E: "bg-blue-100 text-blue-700", F: "bg-purple-100 text-purple-700",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MembersPage() {
  const { items: members, add, update, remove } = useApi<Member>("members");
  const { items: attendances } = useApi<ApiAttendance>("attendances");
  const { items: matches } = useApi<ApiMatch>("matches");
  const { items: matchHistory } = useApi<ApiMatchHistory>("match-history");

  const usedMemberIds = useMemo(() => {
    const ids = new Set<string>();
    attendances.forEach((a) => ids.add(a.memberId));
    matches.forEach((m) => {
      if (m.team1Player1Id) ids.add(m.team1Player1Id);
      if (m.team1Player2Id) ids.add(m.team1Player2Id);
      if (m.team2Player1Id) ids.add(m.team2Player1Id);
      if (m.team2Player2Id) ids.add(m.team2Player2Id);
    });
    matchHistory.forEach((h) => {
      ids.add(h.memberId);
      if (h.partnerId) ids.add(h.partnerId);
      ids.add(h.opponent1Id);
      ids.add(h.opponent2Id);
    });
    return ids;
  }, [attendances, matches, matchHistory]);
  const [filterClass, setFilterClass] = useState<MemberClass | "all">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", photo: "", address: "", class: "A" as MemberClass });
  const [page, setPage] = useState(1);
  const perPage = 15;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const internalMembers = useMemo(() => members.filter((m) => m.type === "internal" || !m.type), [members]);

  const filtered = internalMembers
    .filter((m) => filterClass === "all" || m.class === filterClass)
    .filter((m) => !search.trim() || m.name.toLowerCase().includes(search.toLowerCase()));

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  function onSearch(e: React.ChangeEvent<HTMLInputElement>) { setSearch(e.target.value); setPage(1); }

  function onFilterClass(k: MemberClass | "all") { setFilterClass(k); setPage(1); }

  function openAdd() { setEditId(null); setForm({ name: "", phone: "", photo: "", address: "", class: "A" }); setShowForm(true); }

  function openEdit(m: Member) {
    setEditId(m.id);
    setForm({ name: m.name, phone: m.phone || "", photo: m.photo || "", address: m.address || "", class: m.class as MemberClass });
    setShowForm(true);
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { const b64 = await fileToBase64(file); setForm({ ...form, photo: b64 }); }
  }

  function removePhoto() { setForm({ ...form, photo: "" }); if (fileInputRef.current) fileInputRef.current.value = ""; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload: Record<string, unknown> = { name: form.name.trim(), phone: form.phone || null, photo: form.photo || null, address: form.address || null, class: form.class };
    if (editId) await update(editId, payload);
    else await add({ ...payload, joinedAt: new Date().toISOString().split("T")[0] });
    setShowForm(false);
  }

  async function toggleActive(m: Member) { await update(m.id, { isActive: !m.isActive }); }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anggota</h1>
          <p className="mt-0.5 text-sm text-gray-500">{internalMembers.length} total anggota</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md">
          <Plus className="h-4 w-4" /> Tambah Anggota
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={onSearch} placeholder="Cari anggota..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onFilterClass("all")} className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${filterClass === "all" ? "bg-[#0d9488] text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>Semua</button>
          {CLASSES.map((k) => (
            <button key={k} onClick={() => onFilterClass(k)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${filterClass === k ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
              style={filterClass === k ? { backgroundImage: classColors[k].replace("bg-gradient-to-br ", "") } : {}}>
              {k}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{internalMembers.length === 0 ? "Belum ada anggota" : "Tidak ditemukan"}</p>
          {internalMembers.length === 0 && <button onClick={openAdd} className="mt-3 text-sm font-medium text-[#0d9488] hover:underline">Tambah anggota pertama</button>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Anggota</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3 hidden md:table-cell">Alamat</th>
                <th className="px-4 py-3 hidden sm:table-cell">Bergabung</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((m) => (
                <tr key={m.id} className={`transition-colors hover:bg-gray-50/50 ${!m.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.photo ? (
                        <img src={m.photo} alt={m.name} className="h-9 w-9 rounded-lg object-cover shadow-sm" />
                      ) : (
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm ${classColors[m.class as MemberClass] || "bg-gray-400"}`}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{m.name}</p>
                        <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${classBadge[m.class as MemberClass] || "bg-gray-100 text-gray-600"}`}>
                          {levelLabel(m.class)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${classBadge[m.class as MemberClass] || "bg-gray-100 text-gray-600"}`}>{m.class}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-[200px] truncate">
                    {m.address ? <><MapPin className="mr-1 inline h-3 w-3" />{m.address}</> : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">
                    {new Date(m.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleActive(m)} className={`rounded-lg p-1.5 transition-colors ${m.isActive ? "text-gray-400 hover:bg-green-50 hover:text-green-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`} title={m.isActive ? "Nonaktifkan" : "Aktifkan"}>
                        {m.isActive ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </button>
                      <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!usedMemberIds.has(m.id) && (
                        <button onClick={() => remove(m.id)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">{(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} dari {filtered.length}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">Sebelumnya</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${p === page ? "bg-[#0d9488] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">Selanjutnya</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Anggota" : "Tambah Anggota"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Foto</label>
                <div className="mt-1.5 flex items-center gap-4">
                  {form.photo ? (
                    <div className="relative">
                      <img src={form.photo} alt="Preview" className="h-16 w-16 rounded-xl object-cover shadow-sm" />
                      <button type="button" onClick={removePhoto} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-gray-400"><Camera className="h-6 w-6" /></div>
                  )}
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-all hover:bg-gray-50">
                    {form.photo ? "Ganti Foto" : "Pilih Foto"}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: toTitleCase(e.target.value) })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Nama anggota" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telepon</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="08xxx" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Alamat</label>
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: toTitleCase(e.target.value) })} rows={2} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Alamat anggota" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kelas</label>
                <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value as MemberClass })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                  {CLASSES.map((k) => (<option key={k} value={k}>Kelas {k}</option>))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50">Batal</button>
                <button type="submit" className="rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md">{editId ? "Simpan" : "Tambah"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function levelLabel(cls: string) {
  const map: Record<string, string> = { A: "Expert", B: "Advanced", C: "Intermediate", D: "Intermediate", E: "Beginner", F: "Beginner" };
  return map[cls] || "Member";
}

function Users(props: React.ComponentProps<"svg">) {
  return (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
}
