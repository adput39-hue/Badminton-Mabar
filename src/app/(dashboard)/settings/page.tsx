"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiPb } from "@/lib/api-types";
import { Save, Upload, ImageIcon } from "lucide-react";
import { useToast } from "@/components/toast";

export default function SettingsPage() {
  const { items: pbs, update: updatePb } = useApi<ApiPb>("pbs");

  const [user, setUser] = useState<{ pb?: { id: string; name: string } } | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const myPb = pbs.find((p) => p.id === user?.pb?.id);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        // instant load from cache
        if (u.pb) {
          setName(u.pb.name || "");
          setLogoUrl(u.pb.logoUrl || "");
          const cached = localStorage.getItem("pb_" + u.pb.id);
          if (cached) {
            const p = JSON.parse(cached);
            setName(p.name || u.pb.name || "");
            setAddress(p.address || "");
            setPhone(p.phone || "");
            setLogoUrl(p.logoUrl || u.pb.logoUrl || "");
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (myPb) {
      setName(myPb.name);
      setAddress(myPb.address || "");
      setPhone(myPb.phone || "");
      setLogoUrl(myPb.logoUrl || "");
      // cache for next load
      try { localStorage.setItem("pb_" + myPb.id, JSON.stringify(myPb)); } catch {}
    }
  }, [myPb]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !myPb) return;
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!user?.pb?.id || !name.trim() || saving) return;
    setSaving(true);
    try {
      const result = await updatePb(user.pb.id, { name: name.trim(), address: address || null, phone: phone || null, logoUrl: logoUrl || null });
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        u.pb.name = name.trim();
        u.pb.logoUrl = result?.logoUrl || logoUrl || null;
        localStorage.setItem("user", JSON.stringify(u));
      }
      toast("success", "Pengaturan berhasil disimpan");
    } catch (err) {
      toast("error", "Gagal menyimpan: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan PB</h1>
        <p className="mt-0.5 text-sm text-gray-500">Kelola profil PB Anda</p>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">Informasi PB</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nama PB</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Alamat</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. Telepon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Logo</label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-gray-300" />}
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="URL logo atau upload"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
                  <label className="inline-flex cursor-pointer items-center gap-1 self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <Upload className="h-3 w-3" /> {logoUploading ? "Mengupload..." : "Upload"}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">Upload gambar atau masukkan URL logo PB</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
