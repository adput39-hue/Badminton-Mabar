"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { listenBotState, isFirebaseConfigured as firebaseConfigured } from "@/lib/firebase";
import { MessageCircle, Save, Loader2, ChevronDown, Play, Smartphone, RefreshCw, QrCode, LogOut } from "lucide-react";

interface WaTemplateForm {
  name: string;
  text: string;
  variables: string;
}

type WaMode = "self" | "meta";

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
  const [mode, setMode] = useState<WaMode>("self");
  const [botToken, setBotToken] = useState("");
  const [hasBotToken, setHasBotToken] = useState(false);
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [templates, setTemplates] = useState<Record<string, WaTemplateForm>>({
    jadwal: { name: "", text: "", variables: "" },
    reminder: { name: "", text: "", variables: "" },
    bayar: { name: "", text: "", variables: "" },
  });
  const [refreshedAt, setRefreshedAt] = useState(0);
  const [queueSummary, setQueueSummary] = useState<string>("");
  const [botStatus, setBotStatus] = useState<{ state: string; qr?: string; at?: string }>({ state: "offline" });
  const [botLoading, setBotLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (firebaseConfigured()) {
        const { readBotState } = await import("@/lib/firebase");
        const st = await readBotState();
        if (!cancelled && st && typeof st.state === "string") {
          setBotStatus(st as { state: string; qr?: string; at?: string });
        }
      } else {
        try {
          const res = await fetch("/api/whatsapp/bot");
          const data = await res.json();
          if (!cancelled && typeof data?.state === "string") setBotStatus(data);
        } catch {}
      }
      try {
        const res = await fetch("/api/whatsapp/config");
        const data = await res.json();
        if (!cancelled && data.hasToken !== undefined) {
          setMode(data.mode === "meta" ? "meta" : "self");
          setHasBotToken(Boolean(data.hasBotToken));
          setBotToken(data.botToken || "");
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (firebaseConfigured()) {
      const unsub = listenBotState((state) => {
        if (cancelled) return;
        if (state && typeof state.state === "string") {
          setBotStatus({ state: state.state, qr: state.qr, at: state.at });
        } else {
          setBotStatus({ state: "offline" });
        }
      });
      return () => {
        cancelled = true;
        if (unsub) unsub();
      };
    }
    const t = setInterval(refreshBotStatus, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
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
          mode,
          botToken: botToken.startsWith("••") ? undefined : botToken,
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
        setMode(d.mode === "meta" ? "meta" : "self");
        setHasBotToken(Boolean(d.hasBotToken));
        setBotToken(d.botToken || "");
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

  async function refreshBotStatus(force = false) {
    if (botLoading) return;
    if (force) {
      setBotLoading(true);
      try {
        const res = await fetch("/api/whatsapp/bot", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cmd: "refresh" }),
        });
        if (res.ok) {
          toast("success", "Bot diminta membuat QR baru. Tunggu beberapa detik...");
          setTimeout(refreshBotStatus, 2500);
        } else {
          toast("error", "Gagal meminta QR baru");
        }
      } catch {
        toast("error", "Gagal meminta QR baru");
      } finally {
        setBotLoading(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/whatsapp/bot");
      const data = await res.json();
      if (typeof data?.state === "string") setBotStatus(data);
    } catch {}
  }

  async function requestLogout() {
    if (!window.confirm("Putuskan sesi WhatsApp bot? QR baru akan muncul untuk scan ulang.")) return;
    if (botLoading) return;
    setBotLoading(true);
    try {
      const res = await fetch("/api/whatsapp/bot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "logout" }),
      });
      if (res.ok) {
        toast("success", "Perintah ganti nomor dikirim. Tunggu bot memutus sesi & tampilkan QR baru.");
        setTimeout(refreshBotStatus, 3000);
      } else {
        toast("error", "Gagal mengirim perintah ganti nomor");
      }
    } catch {
      toast("error", "Gagal mengirim perintah ganti nomor");
    } finally {
      setBotLoading(false);
    }
  }

  async function checkQueue() {
    const tk = botToken.startsWith("••") ? "" : botToken;
    try {
      const res = await fetch("/api/whatsapp/status", { headers: { "x-bot-token": tk } });
      if (res.ok) {
        const d = await res.json();
        setQueueSummary(`Antrean: ${d.pending} menunggu · ${d.sending} diproses · ${d.done} selesai`);
      } else {
        setQueueSummary("Cek antrean gagal (token bot belum cocok)");
      }
    } catch {
      setQueueSummary("Cek antrean gagal (server tidak merespons)");
    }
  }

  async function sendTest() {
    const tk = botToken.startsWith("••") ? "" : botToken;
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pb-id": "", "x-bot-token": tk },
        body: JSON.stringify({ type: "test" }),
      });
      const d = await res.json();
      if (res.ok && d.queued) {
        toast("success", `Pesan uji masuk antrean → ${d.phoneTargets} penerima. Bot akan kirim dalam beberapa detik.`);
        setQueueSummary("Menunggu hasil kirim uji...");
      } else if (res.ok && d.ok) {
        toast("success", `Pesan uji terkirim ke ${d.sent} penerima`);
      } else {
        toast("error", d.error || "Gagal kirim uji");
      }
    } catch {
      toast("error", "Gagal kirim uji");
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
            <p className="text-xs text-gray-500">Kirim jadwal, reminder, & tagihan via bot WhatsApp HP</p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700">Cara Kirim</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button onClick={() => setMode("self")} className={`rounded-xl border p-4 text-left transition-all ${mode === "self" ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-gray-200 hover:bg-gray-50"}`}>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[var(--color-primary)]" />
              <span className="text-sm font-bold text-gray-900">Bot WhatsApp HP (self-hosted)</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">Gratis. Pakai HP Android + Termux + Baileys. Scan QR sekali.</p>
          </button>
          <button onClick={() => setMode("meta")} className={`rounded-xl border p-4 text-left transition-all ${mode === "meta" ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-gray-200 hover:bg-gray-50"}`}>
            <span className="text-sm font-bold text-gray-900">Meta Cloud API</span>
            <p className="mt-1 text-xs text-gray-500">Resmi, butuh token Meta. Khusus yang sudah punya setup Meta.</p>
          </button>
        </div>
      </div>

      {mode === "self" && (
        <div className="mb-5 rounded-xl border border-green-100 bg-green-50 p-4">
          <p className="mb-2 text-sm font-bold text-green-900">Setup bot (sekali saja):</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-green-900">
            <li>Buat <b>Token Bot</b> di bawah → <b>Simpan</b>.</li>
            <li>Jalankan bot: <code className="font-mono">wa-bot\wa-bot.js</code> di PC yang nyala 24 jam (ada file <b>start-bot.bat</b>).</li>
            <li>Bot mengirim <b>QR code</b> ke halaman ini → scan pakai WhatsApp nomor khusus di HP (Setelan → Perangkat tertaut).</li>
            <li>Terhubung → bot otomatis mengirim pesan dari antrean.</li>
          </ol>
        </div>
      )}

      {mode === "meta" && (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="mb-2 text-sm font-bold text-blue-900">Setup Meta Cloud API (sekali saja):</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-900">
            <li>Buka business.facebook.com → daftar Meta Business → hubungkan WhatsApp Business number.</li>
            <li>Buka developers.facebook.com → buat App Business → tambah produk WhatsApp.</li>
            <li>Salin Access Token (mulai EAAG...) dan Phone number ID.</li>
            <li>Isi kedua di bawah → Simpan.</li>
          </ol>
        </div>
      )}

      {mode === "self" && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[var(--color-primary)]" />
              <span className="text-sm font-bold text-gray-900">Status Bot WhatsApp</span>
            </div>
            <button onClick={() => refreshBotStatus(true)} disabled={botLoading} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {botLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Segarkan QR
            </button>
          </div>

          {botStatus.state === "connected" && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
              Bot terhubung — siap menerima antrean pesan.
            </div>
          )}

          {botStatus.state === "qr" && (
            <div className="flex flex-col items-center gap-3 py-2 sm:flex-row sm:items-start">
              {botStatus.qr && <img src={botStatus.qr} alt="QR WhatsApp" className="h-48 w-48 rounded-xl border border-gray-200 bg-white object-contain p-2" />}
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold text-amber-700">Scan QR ini pakai WhatsApp nomor khusus</p>
                <p className="mt-1 text-xs text-gray-500">Buka WhatsApp di HP → Setelan → Perangkat tertaut → Tautkan perangkat → arahkan kamera ke QR.</p>
                <p className="mt-1 text-[11px] text-gray-400">QR berlaku singkat — jika kedaluwarsa, klik Segarkan.</p>
              </div>
            </div>
          )}

          {botStatus.state === "offline" && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300"></span>
              Bot belum berjalan. Jalankan <code className="font-mono">wa-bot\start-bot.bat</code> di PC bot, lalu Segarkan.
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
            <p className="text-[11px] text-gray-400">{botStatus.at ? `Terakhir diperbarui: ${new Date(botStatus.at).toLocaleString("id-ID")}` : "Belum ada pembaruan bot"}</p>
            <button onClick={requestLogout} disabled={botLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50">
              {botLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />} Ganti Nomor
            </button>
          </div>
        </div>
      )}

      {mode === "self" && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700">Token Bot</label>
          <div className="mt-1.5 flex gap-2">
            <input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={hasBotToken ? "•••••• (tersimpan)" : "Token rahasia untuk disambung ke bot HP"}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
          </div>
          {hasBotToken && <p className="mt-1 text-[10px] text-gray-400">Token tersimpan. Kosongkan &amp; simpan untuk buat ulang.</p>}
        </div>
      )}

      {mode === "meta" && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Access Token Meta</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? "•••••• (token tersimpan)" : "EAAG..."}
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
            {hasToken && <p className="mt-1 text-[10px] text-gray-400">Token tersimpan. Kosongkan &amp; simpan untuk hapus.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number ID</label>
            <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="123456789012345" className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
          </div>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(templates).map(([key, t]) => (
          <div key={key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-gray-900">{TYPE_LABELS[key].label}</h3>
              <p className="text-xs text-gray-500">{TYPE_LABELS[key].desc}</p>
            </div>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500">Nama Template Meta {mode === "self" && "(opsional)"}</label>
                <input value={t.name} onChange={(e) => setTpl(key, { name: e.target.value })} placeholder={mode === "self" ? "Bot pakai teks bebas, ini tidak dipakai" : "mis. mabar_jadwal"} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Kunci template (isian pesan)</label>
                <p className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-400">{`{nama} {judul} {tanggal} {jam} {lokasi} {htm} {htmInsidentil} {namaPB} {kelas}`}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Isi Pesan</label>
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

      <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={sendTest} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 transition-all hover:bg-green-100 disabled:opacity-50">
            <Play className="h-3.5 w-3.5" /> Kirim Uji
          </button>
          <button onClick={checkQueue} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50">
            <RefreshCw className="h-3.5 w-3.5" /> Cek Antrean
          </button>
          {queueSummary && <span className="text-xs text-gray-500">{queueSummary}</span>}
        </div>
        <button onClick={saveConfig} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="h-4 w-4" /> Simpan</>}
        </button>
      </div>
    </div>
  );
}