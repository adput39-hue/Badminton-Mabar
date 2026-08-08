"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { toPng } from "html-to-image";
import { Loader2, Upload, Download, X, Check, ImageIcon, RotateCcw } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { getGameTarget, getGameWinner, getNotesText } from "@/lib/utils";
import type { ApiMatch, ApiMember } from "@/lib/api-types";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.05;
const DEFAULT_ZOOM = 1;
const CARD_RATIO = 2 / 3;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// zoom yang membuat foto pas mengisi kartu (cover) berdasarkan rasio foto
function coverZoomFor(ratio: number): number {
  return ratio >= CARD_RATIO ? ratio / CARD_RATIO : CARD_RATIO / ratio;
}

interface MatchCardModalProps {
  match: ApiMatch;
  members: ApiMember[];
  title: string;
  pbColor?: string | null;
  onClose: () => void;
  onSaved?: () => void;
  allowUpload?: boolean;
}

function gameModeLabel(notes: string | null): string {
  if (!notes) return "1 Game 30";
  let n = notes;
  try {
    const obj = JSON.parse(notes);
    if (typeof obj?.text === "string") n = obj.text;
  } catch { /* keep as-is */ }
  if (n.startsWith("2-21")) return "2 Game 21";
  if (n.startsWith("1-42")) return "1 Game 42";
  if (n === "1x42") return "1 Game 42";
  if (n === "2x21") return "2 Game 21";
  return "1 Game 30";
}

export function MatchCardModal({ match, members, title, pbColor, onClose, onSaved, allowUpload = false }: MatchCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [autoZoom, setAutoZoom] = useState<number>(DEFAULT_ZOOM);
  const [dragging, setDragging] = useState(false);
  const photoBoxRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const ratioRef = useRef<number>(1);
  const touchedRef = useRef(false);

  const g1 = `#${(pbColor || "#0d9488").replace(/^#/, "")}`;
  const g2 = g1;
  const getName = (id: string) => members.find((m) => m.id === id)?.name || "—";

  const hasG2 = match.scoreTeam1Game2 != null || match.scoreTeam2Game2 != null;
  const hasG3 = match.scoreTeam1Game3 != null;
  const gameCols = 1 + (hasG2 ? 1 : 0) + (hasG3 ? 1 : 0);

  const target = getGameTarget(getNotesText(match.notes));
  const g1w = getGameWinner(match.scoreTeam1 ?? 0, match.scoreTeam2 ?? 0, target);
  const g2w = hasG2 ? getGameWinner(match.scoreTeam1Game2 ?? 0, match.scoreTeam2Game2 ?? 0, target) : null;
  const g3w = hasG3 ? getGameWinner(match.scoreTeam1Game3 ?? 0, match.scoreTeam2Game3 ?? 0, target) : null;
  const winCls = (w: 1 | 2 | null, team: 1 | 2) => w === team ? "text-green-400 font-black" : "text-white/80 font-bold";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/match-cards/${match.id}/photo`);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        if (!cancelled) setPhoto(dataUrl);
      } catch {
        // foto tidak tersimpan, biarkan kosong
      }
    })();
    return () => { cancelled = true; };
  }, [match.id]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setError("");
    try {
      setLoading(true);
      const data = await compressImage(file, 1200);
      const r = await new Promise<number>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1);
        img.onerror = () => resolve(1);
        img.src = data;
      });
      ratioRef.current = r;
      const az = clamp(Number(coverZoomFor(r).toFixed(2)), ZOOM_MIN, ZOOM_MAX);
      setAutoZoom(az);
      touchedRef.current = false;
      setPhoto(data);
      setPan({ x: 0, y: 0 });
      setZoom(az);
    } catch (e) {
      setError((e as Error).message || "Gagal memproses foto");
    } finally {
      setLoading(false);
    }
  }

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : ratioRef.current;
    ratioRef.current = r;
    const az = clamp(coverZoomFor(r), ZOOM_MIN, ZOOM_MAX);
    setAutoZoom(az);
    if (!touchedRef.current) setZoom(az);
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const pbId = JSON.parse(localStorage.getItem("user") || "{}").pbId || "";
      const res = await fetch("/api/match-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pb-id": pbId },
        body: JSON.stringify({ matchId: match.id, photo }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "API error"));
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message || "Gagal menyimpan card");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `match-card-${match.round}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      setError((e as Error).message || "Gagal mengunduh card");
    } finally {
      setDownloading(false);
    }
  }

  function onPanStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (!photo || !allowUpload) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y };
    setDragging(true);
  }

  function onPanMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = dragStart.current;
    if (!s || !photoBoxRef.current) return;
    touchedRef.current = true;
    const rect = photoBoxRef.current.getBoundingClientRect();
    const r = ratioRef.current;
    const containW = Math.min(rect.width, rect.height * r);
    const containH = Math.min(rect.height, rect.width / r);
    const cx = Math.max(0, (containW * zoom - rect.width) / 2);
    const cy = Math.max(0, (containH * zoom - rect.height) / 2);
    setPan({
      x: clamp(s.x + (e.clientX - s.px), -cx, cx),
      y: clamp(s.y + (e.clientY - s.py), -cy, cy),
    });
  }

  function onPanEnd() {
    dragStart.current = null;
    setDragging(false);
  }

  function onWheelZoom(e: ReactWheelEvent<HTMLDivElement>) {
    if (!photo || !allowUpload) return;
    e.preventDefault();
    touchedRef.current = true;
    setZoom(clamp(Number((zoom * (e.deltaY < 0 ? 1.08 : 0.92)).toFixed(2)), ZOOM_MIN, ZOOM_MAX));
  }

  function changeZoom(v: number) {
    touchedRef.current = true;
    setZoom(clamp(Number(v.toFixed(2)), ZOOM_MIN, ZOOM_MAX));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Match Card</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          {/* Card preview */}
          <div className="flex items-start justify-center">
            <div
              ref={cardRef}
              className="relative aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-2xl shadow-xl"
              style={{ background: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)` }}
            >
              {photo ? (
                <div
                  ref={photoBoxRef}
                  className={`absolute inset-0 overflow-hidden ${allowUpload ? "cursor-grab active:cursor-grabbing" : ""}`}
                  style={{ touchAction: "none" }}
                  onPointerDown={onPanStart}
                  onPointerMove={onPanMove}
                  onPointerUp={onPanEnd}
                  onPointerCancel={onPanEnd}
                  onWheel={onWheelZoom}
                >
                  <img
                    src={photo}
                    alt="Foto pertandingan"
                    draggable={false}
                    onLoad={onImgLoad}
                    className={`h-full w-full object-contain select-none ${allowUpload ? "pointer-events-none" : ""}`}
                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                  />
                  {dragging && <div className="absolute inset-0 bg-black/10" />}
                </div>
              ) : (
                <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center text-white/40">
                  {allowUpload ? <Upload className="h-10 w-10" /> : <ImageIcon className="h-10 w-10" />}
                  <p className="mt-2 text-xs font-medium">{allowUpload ? "Belum ada foto" : "Foto belum tersedia"}</p>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              <div className="pointer-events-none absolute right-0 bottom-0 left-0 p-5 text-white">
                <p className="text-sm font-bold leading-tight">{title}</p>
                <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-white/70 uppercase">Ganda</p>
                <div className="mt-3">
                  <div className="grid items-center gap-x-1 text-center text-[9px] font-bold tracking-wider text-white/60" style={{ gridTemplateColumns: `1.6fr repeat(${gameCols}, 1fr)` }}>
                    <span className="text-left" />
                    <span>GAME 1</span>
                    {hasG2 && <span>GAME 2</span>}
                    {hasG3 && <span>GAME 3</span>}
                  </div>
                  <div className="mt-0.5 grid items-center gap-x-1 text-center" style={{ gridTemplateColumns: `1.6fr repeat(${gameCols}, 1fr)` }}>
                    <span className="text-left text-[11px] leading-tight font-bold">{getName(match.team1Player1Id)}<br />{getName(match.team1Player2Id)}</span>
                    <span className={`text-lg tabular-nums ${winCls(g1w, 1)}`}>{match.scoreTeam1 ?? 0}</span>
                    {hasG2 && <span className={`text-lg tabular-nums ${winCls(g2w, 1)}`}>{match.scoreTeam1Game2 ?? 0}</span>}
                    {hasG3 && <span className={`text-lg tabular-nums ${winCls(g3w, 1)}`}>{match.scoreTeam1Game3 ?? 0}</span>}
                  </div>
                  <div className="mt-1 grid items-center gap-x-1 border-t border-white/15 pt-1 text-center" style={{ gridTemplateColumns: `1.6fr repeat(${gameCols}, 1fr)` }}>
                    <span className="text-left text-[11px] leading-tight font-bold">{getName(match.team2Player1Id)}<br />{getName(match.team2Player2Id)}</span>
                    <span className={`text-lg tabular-nums ${winCls(g1w, 2)}`}>{match.scoreTeam2 ?? 0}</span>
                    {hasG2 && <span className={`text-lg tabular-nums ${winCls(g2w, 2)}`}>{match.scoreTeam2Game2 ?? 0}</span>}
                    {hasG3 && <span className={`text-lg tabular-nums ${winCls(g3w, 2)}`}>{match.scoreTeam2Game3 ?? 0}</span>}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2.5 text-[10px] text-white/70">
                  <span>{gameModeLabel(match.notes)}</span>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-semibold text-white">{match.winnerTeam === null ? "SERI" : "SELESAI"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3">
            {allowUpload && (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-4 py-8 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">
                <Upload className="h-6 w-6 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Upload Foto Pertandingan</span>
                <span className="text-xs text-gray-400">Foto aksi pemain, format landscape lebih baik</span>
                <input type="file" accept="image/*" className="hidden" disabled={loading} onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = "";
                  onPickFile(file);
                }} />
              </label>
            )}
            {photo && allowUpload && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Zoom</span>
                  <span className="text-xs font-bold text-gray-500">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeZoom(zoom - ZOOM_STEP)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40" disabled={zoom <= ZOOM_MIN}>
                    <span className="text-sm font-bold">−</span>
                  </button>
                  <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={zoom}
                    onChange={(e) => changeZoom(Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-[var(--color-primary)]" />
                  <button onClick={() => changeZoom(zoom + ZOOM_STEP)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40" disabled={zoom >= ZOOM_MAX}>
                    <span className="text-sm font-bold">+</span>
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-gray-400">Geser foto untuk posisi &middot; zoom untuk perbesar/perkecil</p>
              </div>
            )}
            {loading && <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses foto...</p>}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <div className="mt-auto space-y-2">
              {photo && allowUpload && (pan.x !== 0 || pan.y !== 0 || Math.abs(zoom - autoZoom) > 0.001) && (
                <button onClick={() => { touchedRef.current = false; setPan({ x: 0, y: 0 }); setZoom(autoZoom); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Posisi &amp; Zoom
                </button>
              )}
              <button onClick={handleDownload} disabled={!photo || downloading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "Mengunduh..." : "Download PNG"}
              </button>
              {allowUpload && (
                <button onClick={handleSave} disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
                  {saving ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan Card"}
                </button>
              )}
              {allowUpload && <p className="text-center text-[10px] text-gray-400">Foto otomatis dihapus setelah 3 hari</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
