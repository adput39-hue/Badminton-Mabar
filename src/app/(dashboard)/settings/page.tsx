"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiPb } from "@/lib/api-types";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const { items: pbs, update: updatePb } = useApi<ApiPb>("pbs");

  const [user, setUser] = useState<{ pb?: { id: string; name: string } } | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  const myPb = pbs.find((p) => p.id === user?.pb?.id);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (myPb) {
      setName(myPb.name);
      setAddress(myPb.address || "");
      setPhone(myPb.phone || "");
    }
  }, [myPb]);

  async function handleSave() {
    if (!user?.pb?.id || !name.trim()) return;
    await updatePb(user.pb.id, { name: name.trim(), address: address || null, phone: phone || null });
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      u.pb.name = name.trim();
      localStorage.setItem("user", JSON.stringify(u));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm font-semibold text-[#0d9488]">✓ Tersimpan</span>}
          <button onClick={handleSave} disabled={!name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-50">
            <Save className="h-4 w-4" /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
