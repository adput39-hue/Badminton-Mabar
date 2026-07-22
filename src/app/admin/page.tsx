"use client";

import { useState } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiPb } from "@/lib/api-types";
import { Plus, Trash2, X, Search, Building2, Users, Shield, Globe, Phone as PhoneIcon, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const { items: pbs, add: addPb, remove: removePb } = useApi<ApiPb>("pbs");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", address: "", phone: "", adminEmail: "", adminFullName: "", adminPassword: "" });
  const [error, setError] = useState("");

  const filtered = pbs.filter((p) => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase()));

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pb";
  }

  function openAdd() {
    setForm({ name: "", slug: "", address: "", phone: "", adminEmail: "", adminFullName: "", adminPassword: "" });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.slug.trim() || !form.adminEmail.trim() || !form.adminPassword) {
      setError("Nama, slug, email admin, dan password harus diisi"); return;
    }
    try {
      await addPb({
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        address: form.address || null,
        phone: form.phone || null,
        adminEmail: form.adminEmail.trim(),
        adminFullName: form.adminFullName.trim() || null,
        adminPassword: form.adminPassword,
      });
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan PB");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master PB</h1>
          <p className="mt-0.5 text-sm text-gray-500">Kelola seluruh PB dalam sistem — {pbs.length} total</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md">
          <Plus className="h-4 w-4" /> Tambah PB Baru
        </button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari PB..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{pbs.length === 0 ? "Belum ada PB" : "Tidak ditemukan"}</p>
          {pbs.length === 0 && <button onClick={openAdd} className="mt-3 text-sm font-medium text-[#0d9488] hover:underline">Buat PB pertama</button>}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pb) => (
            <div key={pb.id} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0d9488] text-xl shadow-sm">🏸</div>
                  <div>
                    <Link href={`/admin/pbs/${pb.id}`} className="font-semibold text-gray-900 hover:text-[#0d9488] transition-colors">{pb.name}</Link>
                    <p className="text-xs text-gray-400 font-mono">{pb.slug}</p>
                  </div>
                </div>
                <button onClick={() => { if (confirm(`Hapus PB "${pb.name}"? Semua data akan terhapus.`)) removePb(pb.id); }} className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100" title="Hapus PB">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-gray-500">
                {pb.address && <p className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 shrink-0" />{pb.address}</p>}
                {pb.phone && <p className="flex items-center gap-1.5"><PhoneIcon className="h-3.5 w-3.5 shrink-0" />{pb.phone}</p>}
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs">
                <span className="flex items-center gap-1 text-gray-500"><Shield className="h-3.5 w-3.5" />{pb._count?.users ?? 0} admin</span>
                <span className="flex items-center gap-1 text-gray-500"><Users className="h-3.5 w-3.5" />{pb._count?.members ?? 0} anggota</span>
                <span className="flex items-center gap-1 text-gray-500"><Calendar className="h-3.5 w-3.5" />{pb._count?.schedules ?? 0} jadwal</span>
              </div>
              <Link href={`/admin/pbs/${pb.id}`} className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-[#ccfbf1] hover:text-[#0d9488]">
                Kelola PB <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Tambah PB Baru</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Data PB</h3>
                <div className="space-y-3">
                  <div><label className="block text-sm font-medium text-gray-700">Nama PB</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value ? generateSlug(e.target.value) : form.slug })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="PB Garuda" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="pb-garuda" /><p className="mt-1 text-xs text-gray-400">Identifier unik, huruf kecil dan strip</p></div>
                  <div><label className="block text-sm font-medium text-gray-700">Alamat</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Alamat PB" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">Telepon</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="08xxx" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Admin Pertama</h3>
                <div className="space-y-3">
                  <div><label className="block text-sm font-medium text-gray-700">Nama Admin</label><input value={form.adminFullName} onChange={(e) => setForm({ ...form, adminFullName: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Admin PB Garuda" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">Email Admin</label><input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="admin@pbgaruda.com" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">Password Admin</label><input type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Minimal 6 karakter" /></div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" className="rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] hover:shadow-md">Tambah PB</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
