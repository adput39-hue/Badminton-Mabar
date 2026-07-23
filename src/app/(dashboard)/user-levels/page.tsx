"use client";

import { useState } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiUserLevel } from "@/lib/api-types";
import { Plus, Pencil, Trash2, X, Shield } from "lucide-react";

const allMenus = [
  { key: "dashboard", label: "Dashboard" },
  { key: "members", label: "Anggota" },
  { key: "schedules", label: "Jadwal" },
  { key: "mabar", label: "Mabar" },
  { key: "riwayat", label: "Riwayat" },
  { key: "sparing", label: "Sparing" },
  { key: "scoreboard", label: "Scoreboard" },
  { key: "live-score", label: "Live Score" },
  { key: "htm", label: "Bayar HTM" },
  { key: "users", label: "Master User" },
  { key: "user-levels", label: "Level Manager" },
  { key: "finances", label: "Kas PB" },
  { key: "stats", label: "Statistik" },
  { key: "reports", label: "Laporan" },
  { key: "settings", label: "Pengaturan" },
];

export default function UserLevelsPage() {
  const { items: levels, add: addLevel, update: updateLevel, remove: removeLevel } = useApi<ApiUserLevel>("user-levels");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", color: "#0d9488", menus: [] as string[] });
  const [error, setError] = useState("");

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "level";
  }

  function toggleMenu(key: string) {
    setForm((prev) => ({
      ...prev,
      menus: prev.menus.includes(key) ? prev.menus.filter((m) => m !== key) : [...prev.menus, key],
    }));
  }

  function selectAll() {
    setForm((prev) => ({ ...prev, menus: allMenus.map((m) => m.key) }));
  }

  function deselectAll() {
    setForm((prev) => ({ ...prev, menus: [] }));
  }

  function openAdd() {
    setEditId(null);
    setForm({ name: "", slug: "", description: "", color: "#0d9488", menus: ["dashboard"] });
    setError("");
    setShowForm(true);
  }

  function openEdit(l: ApiUserLevel) {
    setEditId(l.id);
    setForm({ name: l.name, slug: l.slug, description: l.description || "", color: l.color || "#0d9488", menus: l.menus || [] });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.slug.trim()) { setError("Nama dan slug harus diisi"); return; }
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
      description: form.description || null,
      color: form.color,
      menus: form.menus,
    };
    try {
      if (editId) await updateLevel(editId, payload);
      else await addLevel(payload);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan level");
    }
  }

  const presetColors = ["#0d9488", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Level Manager</h1>
          <p className="mt-0.5 text-sm text-gray-500">Atur hak akses menu untuk setiap level user</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md">
          <Plus className="h-4 w-4" /> Tambah Level
        </button>
      </div>

      {levels.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Shield className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada level</p>
          <button onClick={openAdd} className="mt-3 text-sm font-medium text-[#0d9488] hover:underline">Buat level pertama</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Level</th>
                <th className="px-5 py-3 hidden sm:table-cell">Slug</th>
                <th className="px-5 py-3 hidden md:table-cell">Deskripsi</th>
                <th className="px-5 py-3 text-center">User</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {levels.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="font-medium text-gray-900">{l.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">{l.slug}</td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{l.description || "—"}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {l._count?.users ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(l)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {l._count && l._count.users === 0 && (
                        <button onClick={() => { if (confirm(`Hapus level "${l.name}"?`)) removeLevel(l.id); }} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Level" : "Tambah Level Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="border-b border-gray-100 px-6 py-3 text-sm text-red-600 bg-red-50">{error}</div>}
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nama Level</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editId ? form.slug : generateSlug(e.target.value) })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Admin Utama" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Slug</label>
                    <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="admin_utama" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Deskripsi level" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Warna</label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-10 cursor-pointer rounded-xl border border-gray-200" />
                    <div className="flex flex-wrap gap-1.5">
                      {presetColors.map((c) => (
                        <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                          className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Akses Menu</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAll} className="text-xs font-medium text-[#0d9488] hover:underline">Pilih Semua</button>
                      <span className="text-xs text-gray-300">|</span>
                      <button type="button" onClick={deselectAll} className="text-xs font-medium text-gray-400 hover:underline">Hapus Semua</button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-2 space-y-1.5">
                    {allMenus.map((menu) => {
                      const selected = form.menus.includes(menu.key);
                      return (
                        <button
                          key={menu.key}
                          type="button"
                          onClick={() => toggleMenu(menu.key)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                            selected ? "border-[#0d9488] bg-[#f0fdfa] text-gray-900" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs transition-all ${
                            selected ? "border-[#0d9488] bg-[#0d9488] text-white" : "border-gray-300"
                          }`}>
                            {selected && <span className="text-[10px]">✓</span>}
                          </div>
                          <span className="font-medium">{menu.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">{form.menus.length} dari {allMenus.length} menu dipilih</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50">
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
