"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiKasMutasi, ApiKasBiaya } from "@/lib/api-types";
import { Plus, Pencil, Trash2, X, ArrowUpRight, ArrowDownRight, Search, Wallet } from "lucide-react";

export default function KasMutasiPage() {
  const { items: mutasis, add, update, remove } = useApi<ApiKasMutasi>("kas-mutasi");
  const { items: biayas } = useApi<ApiKasBiaya>("kas-biaya");

  const [filter, setFilter] = useState<"all" | "masuk" | "keluar">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "masuk", biayaId: "", description: "", amount: "", tanggal: new Date().toISOString().split("T")[0] });

  const filtered = mutasis.filter((m) => {
    if (filter !== "all" && m.type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return m.description.toLowerCase().includes(q);
  });

  const totalMasuk = useMemo(() => mutasis.filter((m) => m.type === "masuk").reduce((s, m) => s + m.amount, 0), [mutasis]);
  const totalKeluar = useMemo(() => mutasis.filter((m) => m.type === "keluar").reduce((s, m) => s + m.amount, 0), [mutasis]);
  const saldo = totalMasuk - totalKeluar;

  function getBiayaName(biayaId: string | null) { const b = biayas.find((x) => x.id === biayaId); return b ? b.name : ""; }

  function openAdd() {
    setEditId(null);
    setForm({ type: "masuk", biayaId: "", description: "", amount: "", tanggal: new Date().toISOString().split("T")[0] });
    setShowForm(true);
  }

  function openEdit(m: ApiKasMutasi) {
    setEditId(m.id);
    setForm({ type: m.type, biayaId: m.biayaId || "", description: m.description, amount: String(m.amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), tanggal: m.tanggal.split("T")[0] });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    const payload: Record<string, unknown> = {
      type: form.type, description: form.description.trim(), amount: parseInt(form.amount.replace(/\D/g, '')), tanggal: form.tanggal,
      biayaId: form.biayaId || null,
    };
    if (editId) await update(editId, payload);
    else await add(payload);
    setShowForm(false);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mutasi Kas</h1>
          <p className="mt-0.5 text-sm text-gray-500">{mutasis.length} transaksi</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md">
          <Plus className="h-4 w-4" /> Tambah Mutasi
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600">Pemasukan</p>
          <p className="mt-1 text-xl font-bold text-green-700">Rp {totalMasuk.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-600">Pengeluaran</p>
          <p className="mt-1 text-xl font-bold text-red-700">Rp {totalKeluar.toLocaleString("id-ID")}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${saldo >= 0 ? "border-[#0d9488] bg-[#f0fdfa]" : "border-red-300 bg-red-50"}`}>
          <p className="text-xs font-medium text-gray-600">Saldo</p>
          <p className={`mt-1 text-xl font-bold ${saldo >= 0 ? "text-[#0d9488]" : "text-red-600"}`}>Rp {saldo.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari transaksi..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
        </div>
        <div className="flex gap-1.5">
          {(["all", "masuk", "keluar"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${filter === f ? "bg-[#0d9488] text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              {f === "all" ? "Semua" : f === "masuk" ? "Masuk" : "Keluar"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Wallet className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{mutasis.length === 0 ? "Belum ada transaksi" : "Tidak ditemukan"}</p>
          {mutasis.length === 0 && <button onClick={openAdd} className="mt-3 text-sm font-medium text-[#0d9488] hover:underline">Tambah transaksi pertama</button>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3 hidden sm:table-cell">Kategori</th>
                <th className="px-5 py-3 text-right">Jumlah</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(m.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {m.type === "masuk" ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className="font-medium text-gray-900">{m.description}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{getBiayaName(m.biayaId) || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-bold ${m.type === "masuk" ? "text-green-600" : "text-red-600"}`}>
                      {m.type === "masuk" ? "+" : "-"} Rp {m.amount.toLocaleString("id-ID")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm("Hapus transaksi ini?")) remove(m.id); }} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
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
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Mutasi" : "Tambah Mutasi"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm({ ...form, type: "masuk" })} className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${form.type === "masuk" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>Pemasukan</button>
                <button type="button" onClick={() => setForm({ ...form, type: "keluar" })} className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${form.type === "keluar" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>Pengeluaran</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategori (opsional)</label>
                <select value={form.biayaId} onChange={(e) => setForm({ ...form, biayaId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                  <option value="">— Pilih Kategori —</option>
                  {biayas.filter((b) => b.isActive && b.type === form.type).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}{b.amount ? ` (Rp ${b.amount.toLocaleString("id-ID")})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Deskripsi transaksi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                <input type="text" value={form.amount} onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setForm({ ...form, amount: raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.') });
                  if (!form.biayaId) return;
                  const b = biayas.find((x) => x.id === form.biayaId);
                  if (b && b.amount && !editId) setForm((prev) => ({ ...prev, amount: String(b.amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.') }));
                }} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="50000" />
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