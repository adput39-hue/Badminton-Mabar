"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2, QrCode, Copy, Check, Download } from "lucide-react";

export default function QrAbsenPage() {
  const [pbId, setPbId] = useState("");
  const [pbName, setPbName] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        setPbId(u.pb?.id || "");
        setPbName(u.pb?.name || "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!pbId) return;
    let cancelled = false;
    (async () => {
      try {
        const hostname = window.location.hostname;
        const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
        let origin = window.location.origin;
        if (isLocal) {
          const res = await fetch("/api/network-info");
          const { lanIp } = await res.json() as { lanIp: string };
          if (!cancelled && lanIp) {
            const port = window.location.port ? `:${window.location.port}` : "";
            origin = `${window.location.protocol}//${lanIp}${port}`;
          }
        }
        const url = `${origin}/absen?pb=${encodeURIComponent(pbId)}`;
        if (cancelled) return;
        setLink(url);
        const dataUrl = await QRCode.toDataURL(url, { width: 640, margin: 2 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) {
          const url = `${window.location.origin}/absen?pb=${encodeURIComponent(pbId)}`;
          setLink(url);
          const dataUrl = await QRCode.toDataURL(url, { width: 640, margin: 2 });
          if (!cancelled) setQrDataUrl(dataUrl);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pbId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-absen-${(pbName || "pb").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!pbId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Data PB tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-5 text-center">
        <h1 className="text-lg font-bold text-gray-900">QR Absen Mabar</h1>
        <p className="mt-1 text-xs text-gray-500">Scan untuk absen hadir di jadwal mabar hari ini. Satu QR per PB — pajang di ruangan.</p>
      </div>

      {qrDataUrl ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto w-fit rounded-xl border border-gray-100 p-3">
            <img src={qrDataUrl} alt="QR Absen" className="h-56 w-56" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-800">{pbName}</p>
          <p className="text-xs text-gray-400">{link}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button onClick={downloadQr}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]">
              <Download className="h-3.5 w-3.5" />
              Unduh QR
            </button>
            <button onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Tersalin" : "Salin Link"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        <div className="flex items-start gap-2">
          <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <b>Cara pakai:</b> QR ini menuju halaman publik /absen. Anggota scan QR → memilih jadwal mabar hari ini (jika lebih dari satu) → mengetuk namanya untuk menandai hadir. Anggota yang tidak terdaftar di jadwal belum bisa absen lewat QR.
          </p>
        </div>
      </div>
    </div>
  );
}
