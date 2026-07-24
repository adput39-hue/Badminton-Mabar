"use client";

import { useState } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiKasBiaya } from "@/lib/api-types";
import { Plus, Pencil, Trash2, X, Tag, Search } from "lucide-react";

export default function MasterBiayaPage() {
  const { items: biayas, add, update, remove } = useApi<ApiKasBiaya>("kas-biaya");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "keluar", amount: "", description: "" });

  const filtered = biayas.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q);
  });

  function openAdd() { setEditId(null); setForm({ name: "", type: "keluar", amount: "", description: "" }); setShowForm(true); }

  function openEdit(b: ApiKasBiaya) {
    setEditId(b.id);
    setForm({ name: b.name, type: b.type, amount: b.amount ? String(b.amount) : "", description: b.description || "" });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload: Record<string, unknown> = { name: form.name.trim(), type: form.type, description: form.description || null };
    if (form.amount) payload.amount = parseInt(form.amount);
    if (editId) await update(editId, payload);
    else await add(payload);
    setShowForm(false);
  }

  async function toggleActive(b: ApiKasBiaya) { await update(b.id, { isActive: !b.isActive }); }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Biaya</h1>
          <p className="mt-0.5 text-sm text-gray-500">{biayas.length} kategori biaya</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md">
          <Plus className="h-4 w-4" /> Tambah Biaya
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari biaya..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Tag className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{biayas.length === 0 ? "Belum ada biaya" : "Tidak ditemukan"}</p>
          {biayas.length === 0 && <button onClick={openAdd} className="mt-3 text-sm font-medium text-[#0d9488] hover:underline">Tambah biaya pertama</button>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Tipe</th>
                <th className="px-5 py-3 hidden sm:table-cell">Default</th>
                <th className="px-5 py-3 hidden md:table-cell">Keterangan</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((b) => (
                <tr key={b.id} className={`transition-colors hover:bg-gray-50/50 ${!b.isActive ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3">
                    <span className="font-medium text-gray-900">{b.name}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      b.type === "masuk" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {b.type === "masuk" ? "Pemasukan" : "Pengeluaran"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">
                    {b.amount ? `Rp ${b.amount.toLocaleString("id-ID")}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell max-w-[200px] truncate">{b.description || "—"}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => toggleActive(b)} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                    }`}>
                      {b.isActive ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(b)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm(`Hapus biaya "${b.name}"?`)) remove(b.id); }} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Biaya" : "Tambah Biaya"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Biaya</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Sewa Lapangan" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipe</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                  <option value="masuk">Pemasukan</option>
                  <option value="keluar">Pengeluaran</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Jumlah Default (opsional)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="50000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Keterangan</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Deskripsi biaya" />
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