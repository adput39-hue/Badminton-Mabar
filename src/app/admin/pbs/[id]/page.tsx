"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/api-store";
import type { ApiPb, ApiUser } from "@/lib/api-types";
import { ArrowLeft, Shield, Users, Calendar, Globe, Phone as PhoneIcon, Mail, Pencil, X, Check, Save, Plus, Upload, ImageIcon } from "lucide-react";
import Link from "next/link";

export default function PbDetailPage() {
  const params = useParams();
  const pbId = params.id as string;

  const { items: pbs, update: updatePb } = useApi<ApiPb>("pbs");
  const { items: users, add: addUser, update: updateUser, refresh: refreshUsers } = useApi<ApiUser>("users", `?pbId=${pbId}`);

  const pb = pbs.find((p) => p.id === pbId);
  const pbUsers = users.filter((u) => u.pbId === pbId);

  const [editingPb, setEditingPb] = useState(false);
  const [pbForm, setPbForm] = useState({ name: "", address: "", phone: "", logoUrl: "" });
  const [logoUploading, setLogoUploading] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ fullName: "", email: "", password: "", role: "" });
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ fullName: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pb) return;
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPbForm({ ...pbForm, logoUrl: dataUrl });
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  }

  function startEditPb() {
    if (!pb) return;
    setPbForm({ name: pb.name, address: pb.address || "", phone: pb.phone || "", logoUrl: pb.logoUrl || "" });
    setEditingPb(true);
    setError("");
  }

  async function savePb(e: React.FormEvent) {
    e.preventDefault();
    if (!pb) return;
    try {
      await updatePb(pb.id, { name: pbForm.name.trim(), address: pbForm.address || null, phone: pbForm.phone || null, logoUrl: pbForm.logoUrl || null });
      setEditingPb(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  function startEditUser(u: ApiUser) {
    setUserForm({ fullName: u.fullName, email: u.email, password: "", role: u.role });
    setEditingUser(u.id);
    setError("");
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const payload: Record<string, unknown> = { fullName: userForm.fullName.trim(), email: userForm.email.trim(), role: userForm.role };
      if (userForm.password) payload.password = userForm.password;
      await updateUser(editingUser, payload);
      setEditingUser(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  function openAddUser() {
    setAddUserForm({ fullName: "", email: "", password: "" });
    setError("");
    setShowAddUser(true);
  }

  async function submitAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!addUserForm.fullName.trim() || !addUserForm.email.trim() || !addUserForm.password) {
      setError("Nama, email, dan password harus diisi");
      return;
    }
    try {
      await addUser({ ...addUserForm, role: "admin_pb", pbId });
      setShowAddUser(false);
      await refreshUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan admin");
    }
  }

  if (!pb) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-gray-500">Memuat data PB...</p>
        <Link href="/admin" className="mt-4 inline-flex items-center gap-1 text-sm text-[#0d9488] hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#0d9488] transition-colors">
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar PB
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl shadow-sm ${pb.logoUrl ? "" : "bg-[#0d9488]"}`}>
              {pb.logoUrl ? <img src={pb.logoUrl} alt={pb.name} className="h-full w-full object-cover" /> : "🏸"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pb.name}</h1>
              <p className="text-sm text-gray-400 font-mono mt-0.5">{pb.slug}</p>
            </div>
          </div>
          {!editingPb && (
            <button onClick={startEditPb} className="rounded-lg p-2 text-gray-400 hover:bg-[#ccfbf1] hover:text-[#0d9488] transition-all" title="Edit PB">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        {editingPb ? (
          <form onSubmit={savePb} className="mt-6 space-y-4 border-t border-gray-100 pt-6">
            {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="block text-xs font-medium text-gray-700">Nama PB</label><input value={pbForm.name} onChange={(e) => setPbForm({ ...pbForm, name: e.target.value })} required className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
              <div><label className="block text-xs font-medium text-gray-700">Alamat</label><input value={pbForm.address} onChange={(e) => setPbForm({ ...pbForm, address: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
              <div><label className="block text-xs font-medium text-gray-700">Telepon</label><input value={pbForm.phone} onChange={(e) => setPbForm({ ...pbForm, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700">Logo</label>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                    {pbForm.logoUrl ? <img src={pbForm.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-gray-300" />}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <input value={pbForm.logoUrl} onChange={(e) => setPbForm({ ...pbForm, logoUrl: e.target.value })} placeholder="URL logo atau upload" className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
                    <label className="inline-flex cursor-pointer items-center gap-1 self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      <Upload className="h-3 w-3" /> {logoUploading ? "Mengupload..." : "Upload"}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">Upload gambar atau masukkan URL logo PB</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingPb(false)} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e]"><Save className="h-4 w-4" /> Simpan</button>
            </div>
          </form>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm text-gray-600"><Globe className="h-4 w-4 text-gray-400 shrink-0" /><span>{pb.address || "—"}</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-600"><PhoneIcon className="h-4 w-4 text-gray-400 shrink-0" /><span>{pb.phone || "—"}</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-600"><Shield className="h-4 w-4 text-gray-400 shrink-0" /><span>{pbUsers.length} admin</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-600"><Users className="h-4 w-4 text-gray-400 shrink-0" /><span>{pb._count?.members ?? 0} anggota</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-600"><Calendar className="h-4 w-4 text-gray-400 shrink-0" /><span>{pb._count?.schedules ?? 0} jadwal</span></div>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-300">ID: {pb.id}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Shield className="h-5 w-5 text-[#0d9488]" /> Admin PB</h2>
            <p className="mt-1 text-sm text-gray-500">Daftar admin yang terdaftar di PB ini</p>
          </div>
          <button onClick={openAddUser} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0f766e] hover:shadow-md">
            <Plus className="h-3.5 w-3.5" /> Tambah Admin
          </button>
        </div>

        {error && !editingPb && !showAddUser && <div className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

        {pbUsers.length === 0 ? (
          <div className="mt-4 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Belum ada admin. Klik "Tambah Admin" untuk membuat.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {pbUsers.map((u) => (
              <div key={u.id}>
                {editingUser === u.id ? (
                  <form onSubmit={saveUser} className="rounded-xl border border-[#0d9488] bg-[#f0fdfa] px-5 py-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className="block text-xs font-medium text-gray-700">Nama</label><input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} required className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
                      <div><label className="block text-xs font-medium text-gray-700">Email</label><input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" /></div>
                      <div><label className="block text-xs font-medium text-gray-700">Password <span className="text-gray-400 font-normal">(kosongkan jika tidak diganti)</span></label><input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Min 6 karakter" /></div>
                      <div><label className="block text-xs font-medium text-gray-700">Role</label><select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"><option value="superadmin">Super Admin</option><option value="admin_pb">Admin PB</option><option value="operator">Operator</option><option value="viewer">Viewer</option></select></div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingUser(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                      <button type="submit" className="inline-flex items-center gap-1 rounded-xl bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0f766e]"><Check className="h-3.5 w-3.5" /> Simpan</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 group">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0d9488] text-sm font-bold text-white shadow-sm">{u.fullName.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{u.fullName}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" />{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#ccfbf1] px-3 py-1 text-xs font-medium text-[#0d9488]">{u.role}</span>
                      <button onClick={() => startEditUser(u)} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Edit admin">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <Link href="/admin" className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:shadow-sm">
          ← Kembali
        </Link>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Tambah Admin untuk {pb.name}</h2>
              <button onClick={() => setShowAddUser(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
            <form onSubmit={submitAddUser} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700">Nama</label><input value={addUserForm.fullName} onChange={(e) => setAddUserForm({ ...addUserForm, fullName: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Nama admin" /></div>
              <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" value={addUserForm.email} onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="admin@example.com" /></div>
              <div><label className="block text-sm font-medium text-gray-700">Password</label><input type="password" value={addUserForm.password} onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })} required className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" placeholder="Min 6 karakter" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e]"><Plus className="h-4 w-4" /> Tambah</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
