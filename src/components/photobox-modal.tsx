"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toPng } from "html-to-image";
import { Loader2, Upload, Download, X, Check, Link2, Trash2, ImageIcon, LayoutTemplate } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { getClientPbId } from "@/lib/tenant";
import { PhotoboxFrame, FRAME_IDS, CUSTOM_FRAME_IDS, FRAME_LABELS, type AnyFrameId, type CustomFrameId } from "./photobox-frame";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.05;

function getStoredPbName(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      return u.pb?.name || "";
    }
  } catch {}
  return "";
}

interface SavedItem {
  id: string;
  frameId: string;
  hasPhoto: boolean;
  url: string;
}

interface CustomFrameData {
  id: string;
  slot: number;
  hasImage: boolean;
  image: string | null;
}

interface PhotoboxModalProps {
  scheduleId: string;
  title: string;
  dateLabel: string;
  pbName?: string;
  onClose: () => void;
}

export function PhotoboxModal({ scheduleId, title, dateLabel, pbName = "", onClose }: PhotoboxModalProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [customFrames, setCustomFrames] = useState<CustomFrameData[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [frameId, setFrameId] = useState<AnyFrameId>("maya");
  const [photo, setPhoto] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const pbId = getClientPbId() || "default";
  const displayName = pbName || getStoredPbName();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/photobox/${scheduleId}`, { headers: { "x-pb-id": pbId } }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data) ? [] : (data.items || []));
      }
      const cRes = await fetch(`/api/custom-frames`, { headers: { "x-pb-id": pbId } }).catch(() => null);
      if (cRes?.ok) {
        const data = await cRes.json();
        if (!cancelled) setCustomFrames(Array.isArray(data) ? data : []);
      }
    })();
    return () => { cancelled = true; };
  }, [scheduleId, pbId]);

  const customFrame = (id: AnyFrameId): string | null => {
    if (!CUSTOM_FRAME_IDS.includes(id as CustomFrameId)) return null;
    const slot = CUSTOM_FRAME_IDS.indexOf(id as CustomFrameId) + 1;
    return customFrames.find((f) => f.slot === slot)?.image || null;
  };

async function saveCustomFrame(slot: number, file: File | null) {
    if (!file) return;
    setError("");
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (!dataUrl.startsWith("data:image/png")) {
        throw new Error("Frame harus format PNG (transparan)");
      }
      const res = await fetch(`/api/custom-frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pb-id": pbId },
        body: JSON.stringify({ slot, image: dataUrl }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "API error"));
      const saved = await res.json();
      setCustomFrames((prev) => {
        const next = prev.filter((f) => f.slot !== slot);
        next.push({ id: saved.id, slot, hasImage: saved.hasImage, image: dataUrl });
        return next.sort((a, b) => a.slot - b.slot);
      });
    } catch (e) {
      setError((e as Error).message || "Gagal upload frame");
    }
  }

  function openSlot(i: number) {
    const item = items[i];
    setActive(i);
    setFrameId(((item?.frameId as AnyFrameId) || FRAME_IDS[i % FRAME_IDS.length]) as AnyFrameId);
    setPhoto(null);
    setPan({ x: 0, y: 0 });
    setZoom(1.2);
    setError("");
    if (item?.hasPhoto) loadPhoto(item.url);
  }

  async function loadPhoto(url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      setPhoto(dataUrl);
    } catch {
      // abaikan
    }
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    setError("");
    try {
      setLoading(true);
      const data = await compressImage(file, 1200);
      setPhoto(data);
      setPan({ x: 0, y: 0 });
      setZoom(1.2);
    } catch (e) {
      setError((e as Error).message || "Gagal memproses foto");
    } finally {
      setLoading(false);
    }
  }

  function onPanStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (!photo) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y };
  }

  function onPanMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = dragStart.current;
    if (!s) return;
    const el = e.currentTarget as HTMLDivElement;
    const rect = el.getBoundingClientRect();
    const maxX = ((zoom - 1) * rect.width) / 2;
    const maxY = ((zoom - 1) * rect.height) / 2;
    setPan({
      x: clamp(s.x + (e.clientX - s.px), -maxX, maxX),
      y: clamp(s.y + (e.clientY - s.py), -maxY, maxY),
    });
  }

  function onPanEnd() {
    dragStart.current = null;
  }

  async function composePng(): Promise<string> {
    if (!frameRef.current) throw new Error("Frame belum siap");
    return toPng(frameRef.current, { pixelRatio: 3, cacheBust: true });
  }

  function renderFrame(panOverride?: { x: number; y: number }) {
    return (
      <PhotoboxFrame
        ref={frameRef}
        frameId={frameId}
        photo={photo}
        title={title}
        dateLabel={dateLabel}
        pbName={displayName}
        customFrame={customFrame(frameId)}
        pan={panOverride || pan}
        zoom={zoom}
      />
    );
  }

  async function handleSave() {
    if (!photo || active === null) return;
    setError("");
    setSaving(true);
    try {
      const png = await composePng();
      const res = await fetch(`/api/photobox/${scheduleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pb-id": pbId },
        body: JSON.stringify({ frameId, photo: png }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "API error"));
      const data = await res.json();
      setItems((prev) => {
        const next = [...prev];
        const idx = next.findIndex((x) => x.id === data.id);
        if (idx >= 0) next[idx] = data;
        else next.push(data);
        return next.slice(0, 4);
      });
    } catch (e) {
      setError((e as Error).message || "Gagal menyimpan photobox");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    if (!photo) return;
    setError("");
    setLoading(true);
    try {
      const png = await composePng();
      const link = document.createElement("a");
      link.download = `photobox-${title.replace(/\s+/g, "-").toLowerCase() || "mabar"}-${active! + 1}.png`;
      link.href = png;
      link.click();
    } catch (e) {
      setError((e as Error).message || "Gagal mengunduh");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    const current = active !== null ? items[active] : undefined;
    const item = current ? undefined : active !== null ? items.find((x) => x.frameId === FRAME_IDS[active]) : undefined;
    const url = current?.url || item?.url;
    if (!url) { setError("Simpan dulu untuk membuat link"); return; }
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Gagal menyalin link");
    }
  }

  async function handleDelete() {
    const current = active !== null ? items[active] : undefined;
    if (!current) return;
    try {
      await fetch(`/api/photobox/${scheduleId}/${current.id}`, { method: "DELETE", headers: { "x-pb-id": pbId } });
      setItems((prev) => prev.filter((x) => x.id !== current.id));
      setPhoto(null);
      setPan({ x: 0, y: 0 });
      setZoom(1.2);
    } catch {
      setError("Gagal menghapus");
    }
  }

  const currentItem = active !== null ? items[active] : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">📸 Photobox</h2>
            <p className="text-xs text-gray-400">{title} · {dateLabel} · {displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowManage(!showManage)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50">
              <LayoutTemplate className="h-3.5 w-3.5" /> Kelola Frame
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {showManage && (
          <div className="border-b border-gray-100 bg-[var(--color-bg)] px-6 py-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Upload Frame Custom (PNG transparan)</h3>
            <p className="mb-3 text-xs text-gray-400">Satu set global untuk semua jadwal. Buat gambar dengan lubang tengah transparan — foto akan tampil di lubang itu. Ukuran sedang-kanan, preferensi sama (persegi).</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((slot) => {
                const f = customFrames.find((cf) => cf.slot === slot);
                return (
                  <label key={slot} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-3 py-3 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-white">
                    <span className="text-xs font-semibold text-gray-500">Custom {slot}</span>
                    {f?.hasImage ? (
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
                        <img src={f.image!} alt={`Custom ${slot}`} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-gray-300"><ImageIcon className="h-6 w-6" /></div>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-primary)]">
                      <Upload className="h-3 w-3" /> {f?.hasImage ? "Ganti" : "Upload PNG"}
                    </span>
                    <input type="file" accept="image/png" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      e.target.value = "";
                      saveCustomFrame(slot, file);
                    }} />
                  </label>
                );
              })}
            </div>
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
        )}

        <div className="flex flex-col gap-4 overflow-y-auto p-6 lg:flex-row">
          {/* Slot list */}
          <div className="w-full lg:w-64">
            <h3 className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Frame ({items.length}/4)</h3>
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
              {[0, 1, 2, 3].map((i) => {
                const item = items[i];
                const isActive = active === i;
                return (
                  <button key={i} onClick={() => openSlot(i)}
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${isActive ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20" : "border-gray-200 hover:border-gray-300"}`}>
                    {item?.hasPhoto ? (
                      <img src={item.url} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 text-gray-300">
                        <ImageIcon className="h-5 w-5" />
                        <span className="mt-1 text-[9px] font-medium text-gray-400">Slot {i + 1}</span>
                      </div>
                    )}
                    {isActive && <span className="absolute right-1 top-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[8px] font-bold text-white">✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] text-gray-400">Tiap slot bisa pakai frame berbeda. Foto otomatis terhapus setelah 7 hari.</p>
          </div>

          {/* Editor */}
          {active === null ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center">
              <ImageIcon className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Pilih salah satu slot di kiri untuk mulai</p>
              <p className="text-xs text-gray-400">Upload foto, pilih frame, geser untuk pas, lalu simpan & bagikan link</p>
            </div>
          ) : (
            <div className="flex-1">
              {/* Frame picker */}
              <div className="mb-3 flex flex-wrap gap-2">
                {FRAME_IDS.map((f) => (
                  <button key={f} onClick={() => setFrameId(f)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${frameId === f ? "bg-[var(--color-primary)] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {FRAME_LABELS[f]}
                  </button>
                ))}
                {CUSTOM_FRAME_IDS.map((cf) => {
                  const slot = CUSTOM_FRAME_IDS.indexOf(cf as CustomFrameId) + 1;
                  const has = customFrames.some((x) => x.slot === slot && x.hasImage);
                  return (
                    <button key={cf} onClick={() => setFrameId(cf)}
                      disabled={!has}
                      title={has ? `Custom ${slot}` : `Belum ada frame custom ${slot}. Upload lewat Kelola Frame.`}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${frameId === cf ? "bg-[var(--color-primary)] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"} disabled:opacity-40`}>
                      Custom {slot}
                    </button>
                  );
                })}
              </div>

              {/* Preview */}
              <div className="flex justify-center rounded-2xl bg-gray-100 p-4">
                <div className="relative overflow-hidden rounded-lg shadow-xl" style={{ width: 400, height: 400, touchAction: "none" }} onPointerDown={onPanStart} onPointerMove={onPanMove} onPointerUp={onPanEnd} onPointerCancel={onPanEnd}>
                  <div style={{ transform: "scale(0.625)", transformOrigin: "top left" }}>
                    {renderFrame()}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={loading}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 disabled:cursor-not-allowed">
                  <Upload className="h-3.5 w-3.5" />
                  {photo ? "Ganti Foto" : "Upload Foto"}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = "";
                  onPickFile(file);
                }} />
                {photo && <p className="text-center text-[10px] text-gray-400">Geser pada preview untuk mengatur posisi foto (crop)</p>}

                {photo && (
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Zoom</span>
                      <span className="text-xs font-bold text-gray-500">{Math.round(zoom * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40" disabled={zoom <= ZOOM_MIN}>
                        <span className="text-sm font-bold">−</span>
                      </button>
                      <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-[var(--color-primary)]" />
                      <button onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40" disabled={zoom >= ZOOM_MAX}>
                        <span className="text-sm font-bold">+</span>
                      </button>
                    </div>
                    {(pan.x !== 0 || pan.y !== 0 || zoom !== 1.2) && (
                      <button onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1.2); }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[10px] font-medium text-gray-500 hover:bg-gray-50">
                        Reset Posisi & Zoom
                      </button>
                    )}
                  </div>
                )}
                {loading && <p className="flex items-center justify-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses...</p>}
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

                <div className="flex flex-wrap gap-2">
                  <button onClick={handleSave} disabled={!photo || saving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-40">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                  <button onClick={handleCopyLink} disabled={!currentItem?.hasPhoto}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
                    {copied ? "Tersalin" : "Salin Link"}
                  </button>
                  <button onClick={handleDownload} disabled={!photo || loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download PNG
                  </button>
                  {currentItem?.hasPhoto && (
                    <button onClick={handleDelete} title="Hapus foto slot ini"
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}