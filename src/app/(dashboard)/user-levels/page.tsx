"use client";

import { useState } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiUserLevel } from "@/lib/api-types";
import { Plus, Pencil, Trash2, X, Shield, Check } from "lucide-react";

const allMenus = [
  { key: "dashboard", label: "Dashboard", desc: "Halaman utama dashboard" },
  { key: "members", label: "Anggota", desc: "Manajemen anggota" },
  { key: "schedules", label: "Jadwal", desc: "Jadwal latihan/tanding" },
  { key: "mabar", label: "Mabar", desc: "Main bareng" },
  { key: "riwayat", label: "Riwayat", desc: "Riwayat pertandingan" },
  { key: "sparing", label: "Sparing", desc: "Sparing & match" },
  { key: "scoreboard", label: "Scoreboard", desc: "Scoreboard & live score" },
  { key: "users", label: "Master User", desc: "Kelola user (admin)" },
  { key: "user-levels", label: "Level Manager", desc: "Atur hak akses level (super admin)" },
  { key: "finances", label: "Kas PB", desc: "Keuangan PB" },
  { key: "stats", label: "Statistik", desc: "Statistik & laporan" },
  { key: "reports", label: "Laporan", desc: "Cetak laporan" },
  { key: "settings", label: "Pengaturan", desc: "Pengaturan akun" },
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
    <div className="mx-auto max-w-5xl">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {levels.map((l) => (
            <div key={l.id} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-lg font-bold shadow-sm" style={{ backgroundColor: l.color }}>
                    {l.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{l.name}</h3>
                    <span className="text-xs text-gray-400 font-mono">{l.slug}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(l)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  {l._count && l._count.users === 0 && (
                    <button onClick={() => { if (confirm(`Hapus level "${l.name}"?`)) removeLevel(l.id); }} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {l.description && <p className="mt-3 text-sm text-gray-500">{l.description}</p>}
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Akses Menu ({l.menus?.length || 0})</p>
                <div className="flex flex-wrap gap-1.5">
                  {(l.menus || []).length === 0 ? (
                    <span className="text-xs text-gray-400 italic">Tidak ada akses</span>
                  ) : (
                    (l.menus || []).map((key) => {
                      const menu = allMenus.find((m) => m.key === key);
                      return menu ? (
                        <span key={key} className="inline-flex items-center gap-1 rounded-full bg-[#ccfbf1] px-2.5 py-0.5 text-xs font-medium text-[#0d9488]">
                          {menu.label}
                        </span>
                      ) : null;
                    })
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                <span className="text-gray-400">Slug: <span className="font-mono text-gray-600">{l.slug}</span></span>
                {l._count && <span className="font-medium text-gray-600">{l._count.users} user</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Level" : "Tambah Level Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nama Level</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editId ? form.slug : generateSlug(e.target.value) })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Admin Utama" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Slug</label>
                  <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 font-mono shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="admin_utama" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Deskripsi level" />
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
                <p className="mt-1 text-xs text-gray-400">Centang menu yang bisa diakses oleh level ini</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {allMenus.map((menu) => {
                    const selected = form.menus.includes(menu.key);
                    return (
                      <button
                        key={menu.key}
                        type="button"
                        onClick={() => toggleMenu(menu.key)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
                          selected
                            ? "border-[#0d9488] bg-[#f0fdfa] text-gray-900"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs transition-all ${
                          selected ? "border-[#0d9488] bg-[#0d9488] text-white" : "border-gray-300"
                        }`}>
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="leading-tight">
                          <span className="font-medium">{menu.label}</span>
                          {selected && <span className="ml-1.5 text-[10px] text-[#0d9488] font-medium">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-400">{form.menus.length} dari {allMenus.length} menu dipilih</p>
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
