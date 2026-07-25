"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiPb } from "@/lib/api-types";
import { Save, Upload, ImageIcon, Palette, Type } from "lucide-react";
import { useToast } from "@/components/toast";

function darken(hex: string, amount: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function lighten(hex: string, amount: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hexToRgb(hex: string) {
  const num = parseInt(hex.replace("#", ""), 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

function getBrightness(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function autoCaptionColor(primary: string) {
  return getBrightness(primary) < 128 ? "#ffffff" : "#0d9488";
}

function setCssVars(primary: string, caption: string, bg?: string) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-primary-hover", darken(primary, 20));
  root.style.setProperty("--color-primary-light", lighten(primary, 180));
  root.style.setProperty("--color-primary-lighter", lighten(primary, 220));
  root.style.setProperty("--color-primary-ring", primary + "1a");
  root.style.setProperty("--color-caption", caption);
  root.style.setProperty("--color-caption-hover", darken(caption, 30));
  root.style.setProperty("--color-bg", bg || DEFAULT_BG);
}

const DEFAULT_PRIMARY = "#0d9488";
const DEFAULT_CAPTION = "#0d9488";
const DEFAULT_BG = "#f0fdfa";

const PRESETS = [
  { name: "Teal", colors: ["#0d9488", "#115e59", "#0f766e", "#14b8a6", "#5eead4"] },
  { name: "Blue", colors: ["#2563eb", "#1e40af", "#1d4ed8", "#3b82f6", "#93c5fd"] },
  { name: "Indigo", colors: ["#4f46e5", "#3730a3", "#4338ca", "#6366f1", "#a5b4fc"] },
  { name: "Purple", colors: ["#7c3aed", "#5b21b6", "#6d28d9", "#8b5cf6", "#c4b5fd"] },
  { name: "Pink", colors: ["#db2777", "#9d174d", "#be185d", "#ec4899", "#f9a8d4"] },
  { name: "Red", colors: ["#dc2626", "#991b1b", "#b91c1c", "#ef4444", "#fca5a5"] },
  { name: "Orange", colors: ["#ea580c", "#9a3412", "#c2410c", "#f97316", "#fdba74"] },
  { name: "Amber", colors: ["#d97706", "#92400e", "#b45309", "#f59e0b", "#fcd34d"] },
  { name: "Yellow", colors: ["#ca8a04", "#854d0e", "#a16207", "#eab308", "#fde047"] },
  { name: "Lime", colors: ["#65a30d", "#3f6212", "#4d7c0f", "#84cc16", "#bef264"] },
  { name: "Green", colors: ["#16a34a", "#166534", "#15803d", "#22c55e", "#86efac"] },
  { name: "Emerald", colors: ["#059669", "#065f46", "#047857", "#10b981", "#6ee7b7"] },
  { name: "Cyan", colors: ["#0891b2", "#155e75", "#0e7490", "#06b6d4", "#67e8f9"] },
  { name: "Sky", colors: ["#0ea5e9", "#075985", "#0284c7", "#38bdf8", "#7dd3fc"] },
  { name: "Violet", colors: ["#8b5cf6", "#5b21b6", "#7c3aed", "#a78bfa", "#c4b5fd"] },
  { name: "Rose", colors: ["#e11d48", "#9f1239", "#be123c", "#f43f5e", "#fda4af"] },
];

export default function SettingsPage() {
  const { items: pbs, update: updatePb } = useApi<ApiPb>("pbs");

  const [user, setUser] = useState<{ pb?: { id: string; name: string } } | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [captionColor, setCaptionColor] = useState(DEFAULT_CAPTION);
  const [bgColor, setBgColor] = useState(DEFAULT_BG);
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
        if (u.pb) {
          setName(u.pb.name || "");
          setLogoUrl(u.pb.logoUrl || "");
          setPrimaryColor(u.primaryColor || u.pb?.primaryColor || DEFAULT_PRIMARY);
          setCaptionColor(u.captionColor || DEFAULT_CAPTION);
          setBgColor(u.bgColor || DEFAULT_BG);
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
      const result = await updatePb(user.pb.id, { name: name.trim(), address: address || null, phone: phone || null, logoUrl: logoUrl || null, primaryColor: primaryColor || null });
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        u.pb.name = name.trim();
        u.pb.logoUrl = result?.logoUrl || logoUrl || null;
        u.pb.primaryColor = primaryColor;
        u.primaryColor = primaryColor;
        u.captionColor = captionColor;
        u.bgColor = bgColor;
        localStorage.setItem("user", JSON.stringify(u));
      }
      setCssVars(primaryColor, captionColor, bgColor);
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
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Alamat</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. Telepon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Logo</label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-gray-300" />}
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="URL logo atau upload"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
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

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">Warna Tema</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Warna Dasar</label>
              <p className="text-xs text-gray-400 mb-2">Warna untuk sidebar, tombol, header, dan aksen utama</p>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-300" style={{ backgroundColor: primaryColor }}>
                  <Palette className="h-5 w-5" style={{ color: getBrightness(primaryColor) < 128 ? "#fff" : "#333" }} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => { setPrimaryColor(e.target.value); setCssVars(e.target.value, captionColor, bgColor); }}
                      className="h-10 w-16 cursor-pointer rounded-lg border border-gray-200 bg-transparent p-0.5" />
                    <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm font-mono" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((g) => (
                      <div key={g.name} className="flex gap-0.5 items-center" title={g.name}>
                        {g.colors.map((c) => (
                          <button key={g.name + "_" + c} onClick={() => { setPrimaryColor(c); setCssVars(c, captionColor, bgColor); }}
                            className="h-5 w-5 rounded-sm border border-gray-200 transition-all hover:scale-110"
                            style={{ backgroundColor: c, outline: primaryColor === c ? "2px solid " + c : "none", outlineOffset: "1px" }} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setPrimaryColor(DEFAULT_PRIMARY); setCssVars(DEFAULT_PRIMARY, captionColor, bgColor); }}
                    className="self-start rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50">Reset ke Default</button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700">Warna Caption</label>
              <p className="text-xs text-gray-400 mb-2">Warna teks aksen seperti subtitle "Main Bareng", label, dan ikon</p>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-300 bg-gray-50">
                  <Type className="h-5 w-5" style={{ color: captionColor }} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input type="color" value={captionColor} onChange={(e) => { setCaptionColor(e.target.value); setCssVars(primaryColor, e.target.value, bgColor); }}
                      className="h-10 w-16 cursor-pointer rounded-lg border border-gray-200 bg-transparent p-0.5" />
                    <input value={captionColor} onChange={(e) => setCaptionColor(e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm font-mono" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["#2563eb", "#7c3aed", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#6b7280", "#111827", "#ffffff"].map((c) => (
                      <button key={c} onClick={() => { setCaptionColor(c); setCssVars(primaryColor, c, bgColor); }}
                        className="h-6 w-6 rounded-full border-2 transition-all hover:scale-110"
                        style={{ backgroundColor: c, borderColor: captionColor === c ? c : "#e5e7eb" }} />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { const c = autoCaptionColor(primaryColor); setCaptionColor(c); setCssVars(primaryColor, c, bgColor); }}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50">Otomatis</button>
                    <button onClick={() => { setCaptionColor(DEFAULT_CAPTION); setCssVars(primaryColor, DEFAULT_CAPTION, bgColor); }}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50">Reset</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700">Warna Background</label>
              <p className="text-xs text-gray-400 mb-2">Warna latar halaman dashboard dan konten</p>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-300" style={{ backgroundColor: bgColor }}>
                  <span className="text-xs font-bold" style={{ color: getBrightness(bgColor) < 150 ? "#fff" : "#333" }}>BG</span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input type="color" value={bgColor} onChange={(e) => { setBgColor(e.target.value); setCssVars(primaryColor, captionColor, e.target.value); }}
                      className="h-10 w-16 cursor-pointer rounded-lg border border-gray-200 bg-transparent p-0.5" />
                    <input value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm font-mono" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Putih", color: "#ffffff" },
                      { label: "Terang", color: "#f8fafc" },
                      { label: "Teal", color: "#f0fdfa" },
                      { label: "Abu", color: "#f1f5f9" },
                      { label: "Batu", color: "#f9fafb" },
                      { label: "Krem", color: "#fff7ed" },
                      { label: "Hitam", color: "#000000" },
                      { label: "Gelap", color: "#0f172a" },
                      { label: "Arang", color: "#1e293b" },
                      { label: "Navy", color: "#1e3a5f" },
                    ].map((opt) => (
                      <button key={opt.color} onClick={() => { setBgColor(opt.color); setCssVars(primaryColor, captionColor, opt.color); }}
                        className="h-7 rounded-md border-2 px-2 text-[10px] font-medium transition-all hover:scale-105"
                        style={{
                          backgroundColor: opt.color,
                          borderColor: bgColor === opt.color ? opt.color : "#e5e7eb",
                          color: getBrightness(opt.color) < 150 ? "#fff" : "#333",
                          outline: bgColor === opt.color ? "2px solid " + opt.color : "none",
                          outlineOffset: "1px",
                        }}>{opt.label}</button>
                    ))}
                  </div>
                  <button onClick={() => { setBgColor(DEFAULT_BG); setCssVars(primaryColor, captionColor, DEFAULT_BG); }}
                    className="self-start rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50">Reset</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
