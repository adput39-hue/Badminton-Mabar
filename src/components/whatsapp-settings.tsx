"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { MessageCircle, Save, Loader2, HelpCircle, ChevronDown, Play } from "lucide-react";

interface WaTemplateForm {
  name: string;
  text: string;
  variables: string;
}

const TYPE_LABELS: Record<string, { label: string; desc: string }> = {
  jadwal: { label: "Jadwal Mabar", desc: "Dikirim ke semua anggota saat menyebar jadwal" },
  reminder: { label: "Reminder Main", desc: "Pengingat ke peserta jadwal" },
  bayar: { label: "Belum Bayar HTM", desc: "Pengingat pembayaran ke peserta yang belum lunas" },
};

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [templates, setTemplates] = useState<Record<string, WaTemplateForm>>({
    jadwal: { name: "", text: "", variables: "" },
    reminder: { name: "", text: "", variables: "" },
    bayar: { name: "", text: "", variables: "" },
  });
  const [openGuide, setOpenGuide] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/whatsapp/config");
        const data = await res.json();
        if (data.hasToken !== undefined) {
          setHasToken(Boolean(data.hasToken));
          setToken(data.token || "");
          setPhoneNumberId(data.phoneNumberId || "");
          const next: Record<string, WaTemplateForm> = { ...templates };
          for (const k of ["jadwal", "reminder", "bayar"]) {
            next[k] = {
              name: data.templates?.[k]?.name || "",
              text: data.templates?.[k]?.text || "",
              variables: (data.templates?.[k]?.variables || []).join(","),
            };
          }
          setTemplates(next);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  function setTpl(key: string, patch: Partial<WaTemplateForm>) {
    setTemplates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function saveConfig() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.startsWith("••") ? undefined : token,
          phoneNumberId,
          templates: Object.fromEntries(
            Object.entries(templates).map(([k, t]) => [
              k,
              { name: t.name, text: t.text, variables: t.variables.split(",").map((v) => v.trim()).filter(Boolean) },
            ])
          ),
        }),
      });
      if (res.ok) {
        const reload = await fetch("/api/whatsapp/config");
        const d = await reload.json();
        setHasToken(Boolean(d.hasToken));
        setToken(d.token || "");
        toast("success", "Konfigurasi WhatsApp disimpan");
      } else {
        toast("error", "Gagal menyimpan konfigurasi");
      }
    } catch {
      toast("error", "Gagal menyimpan konfigurasi");
    } finally {
      setSaving(false);
    }
  }

  function preview(key: string): string {
    const t = templates[key];
    if (!t) return "";
    const jadwal = {
      title: "Main Bareng Mingguan",
      date: new Date(Date.now() + 86400000).toISOString(),
      startTime: "19:00",
      location: "GOR Badminton",
      htm: 25000,
      htmInsidentil: 30000,
    };
    return t.text
      .replace(/\{nama\}/g, "Budi")
      .replace(/\{kelas\}/g, "A")
      .replace(/\{namaPB\}/g, "PB Main Bareng")
      .replace(/\{judul\}/g, jadwal.title)
      .replace(/\{tanggal\}/g, new Date(jadwal.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))
      .replace(/\{jam\}/g, jadwal.startTime)
      .replace(/\{lokasi\}/g, jadwal.location)
      .replace(/\{htm\}/g, String(jadwal.htm))
      .replace(/\{htmInsidentil\}/g, String(jadwal.htmInsidentil));
  }

  async function testSend(key: string) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: key, test: true }),
      });
      const data = await res.json();
      if (res.ok && data.ok) toast("success", "Pesan uji dikirim");
      else toast("error", data.error || "Gagal kirim pesan uji");
    } catch {
      toast("error", "Gagal kirim pesan uji");
    } finally {
      setSavingKey(null);
    }
  }

  if (!loaded) return <div className="py-6 text-center text-sm text-gray-400">Memuat...</div>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">WhatsApp Broadcast</h2>
            <p className="text-xs text-gray-500">Kirim jadwal, reminder, & tagihan otomatis via Meta Cloud API</p>
          </div>
        </div>
        <button onClick={() => setOpenGuide(!openGuide)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          <HelpCircle className="h-3.5 w-3.5" /> Panduan <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openGuide ? "rotate-180" : ""}`} />
        </button>
      </div>

      {openGuide && (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="mb-2 font-bold">Cara setup Meta Cloud API (sekali saja):</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Buka <b>developers.facebook.com</b> → buat App tipe <b>Business</b>.</li>
            <li>Tambahkan produk <b>WhatsApp</b> → hubungkan nomor WhatsApp bisnis kamu.</li>
            <li>Salin <b>Access Token</b> (dari pengaturan WhatsApp / System User) dan <b>Phone number ID</b>.</li>
            <li>Di <b>Message Templates</b>, buat 3 template (jadwal, reminder, tagihan) — sudah atau belum disetujui, teks bebas tetap jadi cadangan.</li>
            <li>Isi token + phone ID di bawah, lalu <b>Simpan</b>.</li>
          </ol>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Access Token Meta</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? "•••••• (token tersimpan)" : "EAAG..."}
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
          {hasToken && <p className="mt-1 text-[10px] text-gray-400">Token tersimpan. Kosongkan & simpan untuk hapus.</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone Number ID</label>
          <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="123456789012345" className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(templates).map(([key, t]) => (
          <div key={key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-gray-900">{TYPE_LABELS[key].label}</h3>
              <p className="text-xs text-gray-500">{TYPE_LABELS[key].desc}</p>
            </div>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500">Nama Template Meta</label>
                <input value={t.name} onChange={(e) => setTpl(key, { name: e.target.value })} placeholder="mis. mabar_jadwal" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Variabel (urut, dipisah koma)</label>
                <input value={t.variables} onChange={(e) => setTpl(key, { variables: e.target.value })} placeholder="nama,judul,tanggal" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Isi Pesan (teks bebas; {`{nama} {judul} {tanggal} {jam} {lokasi} {htm} {htmInsidentil} {namaPB} {kelas}`})</label>
              <textarea value={t.text} onChange={(e) => setTpl(key, { text: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            </div>
            {t.text && (
              <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white p-3 text-xs text-gray-600 whitespace-pre-line">
                <span className="font-semibold text-gray-400">Pratinjau: </span>{preview(key)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
        <button onClick={saveConfig} disabled={saving || !token} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="h-4 w-4" /> Simpan</>}
        </button>
      </div>
    </div>
  );
}