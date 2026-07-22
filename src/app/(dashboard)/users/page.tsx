"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiUser, ApiUserLevel } from "@/lib/api-types";
import { Plus, Pencil, Trash2, X, Search, UserCheck, Shield, Mail, Phone as PhoneIcon } from "lucide-react";

export default function UsersPage() {
  const { items: users, add: addUser, update: updateUser, remove: removeUser } = useApi<ApiUser>("users");
  const { items: levels } = useApi<ApiUserLevel>("user-levels");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", role: "admin_pb", levelId: "" as string });
  const [error, setError] = useState("");

  const filtered = users.filter((u) => !search.trim() || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setEditId(null);
    setForm({ fullName: "", email: "", phone: "", password: "", role: "admin_pb", levelId: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(u: ApiUser) {
    setEditId(u.id);
    setForm({ fullName: u.fullName, email: u.email, phone: u.phone || "", password: "", role: u.role, levelId: u.levelId || "" });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim() || !form.email.trim()) { setError("Nama dan email harus diisi"); return; }
    if (!editId && !form.password) { setError("Password harus diisi untuk user baru"); return; }
    const payload: Record<string, unknown> = {
      fullName: form.fullName.trim(), email: form.email.trim(),
      phone: form.phone || null, role: form.role,
      levelId: form.levelId || null,
    };
    if (form.password) payload.password = form.password;
    try {
      if (editId) await updateUser(editId, payload);
      else await addUser(payload);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan user");
    }
  }

  async function remove(u: ApiUser) {
    if (!confirm(`Hapus user "${u.fullName}"?`)) return;
    try { await removeUser(u.id); } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus user");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master User</h1>
          <p className="mt-0.5 text-sm text-gray-500">{users.length} total user</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md">
          <Plus className="h-4 w-4" /> Tambah User
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari user..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Shield className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{users.length === 0 ? "Belum ada user" : "Tidak ditemukan"}</p>
          {users.length === 0 && <button onClick={openAdd} className="mt-3 text-sm font-medium text-[#0d9488] hover:underline">Tambah user pertama</button>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 hidden sm:table-cell">Level</th>
                <th className="px-4 py-3 hidden md:table-cell">Bergabung</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d9488] text-sm font-bold text-white shadow-sm">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.fullName}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" />{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.phone ? <span className="inline-flex items-center gap-1"><PhoneIcon className="h-3 w-3" />{u.phone}</span> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#ccfbf1] px-2.5 py-0.5 text-xs font-medium text-[#0d9488]">{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {u.level ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: u.level.color }} />
                        {u.level.name}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(u)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus">
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
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit User" : "Tambah User"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Nama user" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="user@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telepon</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="08xxx" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password {editId && <span className="text-gray-400 font-normal">(kosongkan jika tidak diganti)</span>}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Minimal 6 karakter" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                  <option value="superadmin">Super Admin</option>
                  <option value="admin_pb">Admin PB</option>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Level</label>
                <select value={form.levelId} onChange={(e) => setForm({ ...form, levelId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10">
                  <option value="">— Tanpa Level —</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
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
