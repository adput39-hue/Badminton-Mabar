"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useControlData } from "@/lib/api-store";
import { listenAllLiveScores, isFirebaseConfigured } from "@/lib/firebase";
import type { ApiMatch } from "@/lib/api-types";
import { Printer, Swords, Trophy, User, Download, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import ShuttlecockIcon from "@/components/shuttlecock-icon";
import { getNotesText, getGameTarget, getGameWinner } from "@/lib/utils";

const courtColors = [
  { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50", border: "border-green-500" },
  { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-500" },
  { bg: "bg-purple-500", text: "text-purple-600", light: "bg-purple-50", border: "border-purple-500" },
  { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-500" },
  { bg: "bg-rose-500", text: "text-rose-600", light: "bg-rose-50", border: "border-rose-500" },
];

function RacketIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="50" cy="34" rx="26" ry="30" stroke="currentColor" strokeWidth="4" />
      <line x1="50" y1="8" x2="50" y2="62" stroke="currentColor" strokeWidth="1.5" />
      <line x1="26" y1="24" x2="74" y2="24" stroke="currentColor" strokeWidth="1.5" />
      <line x1="24" y1="34" x2="76" y2="34" stroke="currentColor" strokeWidth="1.5" />
      <line x1="26" y1="44" x2="74" y2="44" stroke="currentColor" strokeWidth="1.5" />
      <path d="M46 62 L46 78" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M42 62 L32 74 M58 62 L68 74" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M42 78 L34 90 M58 78 L66 90" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function HasilAkhirPage() {
  const { schedules, members, loaded } = useControlData(60000);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const matchesLoadedRef = useRef(false);
  const liveScoresRef = useRef<Record<string, Record<string, unknown>>>({});
  const [pbName, setPbName] = useState("");
  const [pbLogo, setPbLogo] = useState("");

  const selSparingId = useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("scheduleId"), []);
  const pbId = useMemo(() => {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("pbId");
    if (p) return p;
    try {
      const raw = localStorage.getItem("user");
      if (raw) return JSON.parse(raw).pbId || "";
    } catch {}
    return "";
  }, []);

  useEffect(() => {
    if (!pbId) { matchesLoadedRef.current = true; return; }
    function fetchMatches() {
      fetch("/api/matches", { headers: { "x-pb-id": pbId } })
        .then((r) => r.json())
        .then((data) => {
          const fb = liveScoresRef.current;
          const merged = data.map((m: ApiMatch) => {
            const live = fb[m.id];
            if (!live) return m;
            return {
              ...m,
              courtNumber: (live.courtNumber as number) ?? m.courtNumber,
              scoreTeam1: (live.scoreTeam1 as number) ?? m.scoreTeam1,
              scoreTeam2: (live.scoreTeam2 as number) ?? m.scoreTeam2,
              scoreTeam1Game2: (live.scoreTeam1Game2 as number) ?? m.scoreTeam1Game2,
              scoreTeam2Game2: (live.scoreTeam2Game2 as number) ?? m.scoreTeam2Game2,
              scoreTeam1Game3: (live.scoreTeam1Game3 as number) ?? m.scoreTeam1Game3,
              scoreTeam2Game3: (live.scoreTeam2Game3 as number) ?? m.scoreTeam2Game3,
              status: (live.status as string) || m.status,
              winnerTeam: (live.winnerTeam as number) ?? m.winnerTeam,
              team1Player1Id: (live.team1Player1Id as string) ?? m.team1Player1Id,
              team1Player2Id: (live.team1Player2Id as string) ?? m.team1Player2Id,
              team2Player1Id: (live.team2Player1Id as string) ?? m.team2Player1Id,
              team2Player2Id: (live.team2Player2Id as string) ?? m.team2Player2Id,
            };
          });
          setMatches(merged);
          matchesLoadedRef.current = true;
        })
        .catch(() => { matchesLoadedRef.current = true; });
    }
    fetchMatches();
    if (isFirebaseConfigured()) {
      const unsub = listenAllLiveScores((scores) => {
        liveScoresRef.current = scores;
        setMatches((prev) => prev.map((m) => {
          const live = scores[m.id];
          if (!live) return m;
          return {
            ...m,
            courtNumber: (live.courtNumber as number) ?? m.courtNumber,
            scoreTeam1: (live.scoreTeam1 as number) ?? m.scoreTeam1,
            scoreTeam2: (live.scoreTeam2 as number) ?? m.scoreTeam2,
            scoreTeam1Game2: (live.scoreTeam1Game2 as number) ?? m.scoreTeam1Game2,
            scoreTeam2Game2: (live.scoreTeam2Game2 as number) ?? m.scoreTeam2Game2,
            scoreTeam1Game3: (live.scoreTeam1Game3 as number) ?? m.scoreTeam1Game3,
            scoreTeam2Game3: (live.scoreTeam2Game3 as number) ?? m.scoreTeam2Game3,
            status: (live.status as string) || m.status,
            winnerTeam: (live.winnerTeam as number) ?? m.winnerTeam,
          };
        }));
      });
      return () => { if (unsub) unsub(); };
    }
    const es = new EventSource(`/api/matches/stream${pbId ? `?pbId=${pbId}` : ""}`);
    es.onmessage = fetchMatches;
    return () => { es.close(); };
  }, [pbId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.pb?.name) setPbName(u.pb.name);
        if (u.pb?.logoUrl) setPbLogo(u.pb.logoUrl);
      }
    } catch {}
  }, []);

  const selectedSparing = useMemo(() => schedules.find((s) => s.id === selSparingId), [schedules, selSparingId]);
  const savedSettings = useMemo(() => {
    if (!selectedSparing?.notes) return null;
    try { return JSON.parse(selectedSparing.notes); } catch { return null; }
  }, [selectedSparing]);
  const scheduleGameMode: string = savedSettings?.draftGames || savedSettings?.gameMode || "";
  const totalRounds: number = savedSettings?.totalRounds || 1;

  const sparingMatches = useMemo(() =>
    matches.filter((m) => m.scheduleId === selSparingId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  [matches, selSparingId]);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  const finalStats = useMemo(() => {
    const completed = sparingMatches.filter((m) => m.status === "completed");
    return {
      kitaWins: completed.filter((m) => m.winnerTeam === 1).length,
      lawanWins: completed.filter((m) => m.winnerTeam === 2).length,
      total: completed.length,
    };
  }, [sparingMatches]);

  const dataReady = loaded && matchesLoadedRef.current;

  const captureRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null);

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function capturePng(): Promise<string> {
    setCapturing(true);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const node = captureRef.current;
      if (!node) throw new Error("node not found");
      return await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
    } finally {
      setCapturing(false);
    }
  }

  async function downloadImage() {
    setBusy("png");
    try {
      const dataUrl = await capturePng();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `hasil-akhir-${(pbName || "pb").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      a.click();
    } catch (e) {
      console.error("Gagal download gambar", e);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      const dataUrl = await capturePng();
      const img = await loadImage(dataUrl);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const scale = Math.min(pageW / img.width, pageH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save(`hasil-akhir-${(pbName || "pb").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
    } catch (e) {
      console.error("Gagal download PDF", e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hasil-akhir-page min-h-screen bg-[var(--color-bg)]">
      <div ref={captureRef} className={`mx-auto ${capturing ? "w-[794px] bg-white" : "w-full"}`}>
      <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white">
        <div className="relative mx-auto max-w-5xl overflow-hidden px-4 py-4 sm:px-6">
          <RacketIcon className="absolute -left-8 top-1/2 h-44 w-44 -translate-y-1/2 rotate-12 text-white opacity-15" />
          <RacketIcon className="absolute -right-8 top-1/2 h-44 w-44 -translate-y-1/2 -rotate-12 text-white opacity-15" />
          <ShuttlecockIcon size={60} className="absolute left-28 top-3 text-white opacity-20" />
          <ShuttlecockIcon size={60} className="absolute right-28 bottom-2 text-white opacity-20" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              <h1 className="text-lg font-bold tracking-wide uppercase whitespace-nowrap">Hasil Akhir</h1>
            </div>
            <div className={`no-print flex items-center gap-2 ${capturing ? "invisible" : ""}`}>
              <button onClick={downloadImage}
                className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/25">
                {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Gambar
              </button>
              <button onClick={downloadPdf}
                className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/25">
                {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} PDF
              </button>
            </div>
          </div>

          <div className="relative mt-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
              <span className="text-sm font-bold whitespace-nowrap sm:text-base">{pbName || "PB"}</span>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[10px] font-bold text-gray-700 sm:h-9 sm:w-9 sm:text-xs">{pbLogo ? <img src={pbLogo} alt="" className="h-full w-full object-cover" /> : "PB"}</div>
            </div>
            <div className="shrink-0 text-[34px] font-black tabular-nums whitespace-nowrap sm:text-[40px]">
              <span>{finalStats.kitaWins}</span>
              <span className="mx-2 text-white/60 sm:mx-3">-</span>
              <span>{finalStats.lawanWins}</span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[10px] font-bold text-gray-700 sm:h-9 sm:w-9 sm:text-xs">{selectedSparing?.logoUrl ? <img src={selectedSparing.logoUrl} alt="" className="h-full w-full object-cover" /> : (selectedSparing?.sparingOpponent || "L").slice(0, 4).toUpperCase()}</div>
              <span className="text-sm font-bold whitespace-nowrap sm:text-base">{selectedSparing?.sparingOpponent || "Lawan"}</span>
            </div>
          </div>

          <div className="relative mt-3 flex items-center justify-center gap-2 text-sm text-white/70">
            <span className="whitespace-nowrap">{new Date(selectedSparing?.date || "").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            <span className="opacity-50">•</span>
            <span className="whitespace-nowrap">{finalStats.total} pertandingan selesai</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {!dataReady ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500">Memuat data...</p>
          </div>
        ) : !selectedSparing ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Data tidak ditemukan. Periksa link.</div>
        ) : sparingMatches.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Belum ada pertandingan.</div>
        ) : (
          <div className="space-y-6">
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
              const rm = sparingMatches.filter((m) => m.round === r);
              if (rm.length === 0) return null;
              return (
                <section key={r}>
                  <div className="mb-2 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <h2 className="text-sm font-bold tracking-wide text-gray-700 uppercase">Round {r}</h2>
                    <span className="text-xs text-gray-400">({rm.filter((m) => m.status === "completed").length} selesai)</span>
                  </div>
                  <div className={`${capturing ? "hidden" : "grid"} grid-cols-2 gap-2 print:hidden sm:grid-cols-3 sm:gap-3 lg:grid-cols-4`}>
                    {rm.map((m) => {
                      const hasCourt = m.courtNumber != null;
                      const courtIdx = hasCourt ? (m.courtNumber as number) - 1 : 0;
                      const color = courtColors[courtIdx % courtColors.length];
                      const mIsCompleted = m.status === "completed";
                      const isTwoGame = scheduleGameMode.startsWith("2-21") || (m.notes || "").includes("2-21") || m.scoreTeam1Game2 != null || m.scoreTeam2Game2 != null;
                      const hasG3 = isTwoGame && ((m.scoreTeam1Game3 || 0) > 0 || (m.scoreTeam2Game3 || 0) > 0);
                      const gameCols = isTwoGame ? (hasG3 ? 3 : 2) : 1;
                      const target = getGameTarget(scheduleGameMode || getNotesText(m.notes));
                      const g1w = getGameWinner(m.scoreTeam1 || 0, m.scoreTeam2 || 0, target);
                      const g2w = isTwoGame ? getGameWinner(m.scoreTeam1Game2 || 0, m.scoreTeam2Game2 || 0, target) : null;
                      const g3w = hasG3 ? getGameWinner(m.scoreTeam1Game3 || 0, m.scoreTeam2Game3 || 0, target) : null;
                      const winCls = (w: 1 | 2 | null, team: 1 | 2, strong: boolean): string => {
                        if (!mIsCompleted) return "border-gray-200 bg-white text-gray-700";
                        if (w !== team) return "border-gray-200 bg-gray-50 text-gray-400";
                        return strong ? "border-green-300 bg-green-50 text-green-700" : "border-green-200 bg-green-50/50 text-green-600";
                      };
                      return (
                        <div key={m.id} className={`relative rounded-xl border bg-white p-2 shadow-sm sm:p-2.5 ${hasCourt ? (color.border || "border-gray-200") : "border-gray-200"}`}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[9px] font-bold text-gray-700 sm:text-[10px]">
                              {hasCourt ? (
                                <span className={`rounded px-1 py-0.5 text-[8px] font-black text-white sm:px-1.5 sm:text-[9px] ${color.bg}`}>Lap. {m.courtNumber}</span>
                              ) : (
                                <span className="rounded bg-gray-100 px-1 py-0.5 text-[8px] font-black text-gray-400 sm:px-1.5 sm:text-[9px]">Belum</span>
                              )}
                              {mIsCompleted ? (m.winnerTeam === null ? <span className="text-amber-500">✓ SERI</span> : <span className="text-green-600">✓</span>) : <span className="text-gray-400">⏳</span>}
                            </span>
                            <span className="text-[8px] text-gray-400 sm:text-[9px]">R{m.round}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(${gameCols}, min-content)`, gap: "0.25rem 0.25rem", alignItems: "center" }}>
                            <div className="text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap text-gray-400 sm:text-[10px]">PASANGAN</div>
                            <div className="text-center text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap text-gray-400 sm:text-[10px]">GAME 1</div>
                            {isTwoGame && <div className="text-center text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap text-gray-400 sm:text-[10px]">GAME 2</div>}
                            {hasG3 && <div className="text-center text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap text-gray-400 sm:text-[10px]">GAME 3</div>}
                            <hr className="border-gray-200" style={{ gridColumn: `1 / span ${gameCols + 1}` }} />
                            <div className="flex items-center gap-1 sm:gap-1.5">
                              <ShuttlecockIcon size={14} className="shrink-0 text-green-500" />
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-[10px] sm:text-[11px] ${mIsCompleted ? (m.winnerTeam === 1 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team1Player1Id)}</p>
                                <p className={`truncate text-[10px] sm:text-[11px] ${mIsCompleted ? (m.winnerTeam === 1 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team1Player2Id)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-center">
                              <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${winCls(g1w, 1, true)}`}>{m.scoreTeam1 || 0}</span>
                            </div>
                            {isTwoGame && (
                              <div className="flex items-center justify-center">
                                <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${winCls(g2w, 1, false)}`}>{m.scoreTeam1Game2 || 0}</span>
                              </div>
                            )}
                            {hasG3 && (
                              <div className="flex items-center justify-center">
                                <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${winCls(g3w, 1, false)}`}>{m.scoreTeam1Game3 || 0}</span>
                              </div>
                            )}
                            <hr className="border-gray-200" style={{ gridColumn: `1 / span ${gameCols + 1}` }} />
                            <div className="flex items-center gap-1 sm:gap-1.5">
                              <User size={14} className="shrink-0 text-blue-500" />
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-[10px] sm:text-[11px] ${mIsCompleted ? (m.winnerTeam === 2 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team2Player1Id)}</p>
                                <p className={`truncate text-[10px] sm:text-[11px] ${mIsCompleted ? (m.winnerTeam === 2 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team2Player2Id)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-center">
                              <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${winCls(g1w, 2, true)}`}>{m.scoreTeam2 || 0}</span>
                            </div>
                            {isTwoGame && (
                              <div className="flex items-center justify-center">
                                <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${winCls(g2w, 2, false)}`}>{m.scoreTeam2Game2 || 0}</span>
                              </div>
                            )}
                            {hasG3 && (
                              <div className="flex items-center justify-center">
                                <span className={`inline-flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-bold sm:h-8 sm:w-10 sm:text-xs ${winCls(g3w, 2, false)}`}>{m.scoreTeam2Game3 || 0}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${capturing ? "block" : "hidden print:block"}`}>
                    {(() => {
                      const roundTwoGame = rm.some((m) => scheduleGameMode.startsWith("2-21") || (m.notes || "").includes("2-21") || m.scoreTeam1Game2 != null || m.scoreTeam2Game2 != null);
                      const roundHasG3 = rm.some((m) => (m.scoreTeam1Game3 || 0) > 0 || (m.scoreTeam2Game3 || 0) > 0);
                      return (
                        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-2 py-1 sm:gap-3 sm:px-3">
                          <div className="w-11 shrink-0 sm:w-12" />
                          <div className="min-w-0 flex-1 text-right text-[9px] font-semibold tracking-wider text-gray-400 uppercase">Pasangan</div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="w-7 text-center text-[9px] font-semibold tracking-wider text-gray-400 uppercase sm:w-8">G1</span>
                            {roundTwoGame && <span className="w-7 text-center text-[9px] font-semibold tracking-wider text-gray-400 uppercase sm:w-8">G2</span>}
                            {roundHasG3 && <span className="w-7 text-center text-[9px] font-semibold tracking-wider text-gray-400 uppercase sm:w-8">G3</span>}
                          </div>
                          <div className="shrink-0 text-[10px] font-black text-gray-300 sm:text-xs">&nbsp;</div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="w-7 text-center text-[9px] font-semibold tracking-wider text-gray-400 uppercase sm:w-8">G1</span>
                            {roundTwoGame && <span className="w-7 text-center text-[9px] font-semibold tracking-wider text-gray-400 uppercase sm:w-8">G2</span>}
                            {roundHasG3 && <span className="w-7 text-center text-[9px] font-semibold tracking-wider text-gray-400 uppercase sm:w-8">G3</span>}
                          </div>
                          <div className="min-w-0 flex-1 text-[9px] font-semibold tracking-wider text-gray-400 uppercase">Pasangan</div>
                          <div className="w-4 shrink-0" />
                        </div>
                      );
                    })()}
                    {rm.map((m) => {
                      const hasCourt = m.courtNumber != null;
                      const courtIdx = hasCourt ? (m.courtNumber as number) - 1 : 0;
                      const color = courtColors[courtIdx % courtColors.length];
                      const mIsCompleted = m.status === "completed";
                      const isTwoGame = scheduleGameMode.startsWith("2-21") || (m.notes || "").includes("2-21") || m.scoreTeam1Game2 != null || m.scoreTeam2Game2 != null;
                      const hasG3 = isTwoGame && ((m.scoreTeam1Game3 || 0) > 0 || (m.scoreTeam2Game3 || 0) > 0);
                      const target = getGameTarget(scheduleGameMode || getNotesText(m.notes));
                      const g1w = getGameWinner(m.scoreTeam1 || 0, m.scoreTeam2 || 0, target);
                      const g2w = isTwoGame ? getGameWinner(m.scoreTeam1Game2 || 0, m.scoreTeam2Game2 || 0, target) : null;
                      const g3w = hasG3 ? getGameWinner(m.scoreTeam1Game3 || 0, m.scoreTeam2Game3 || 0, target) : null;
                      const winCls = (w: 1 | 2 | null, team: 1 | 2, strong: boolean): string => {
                        if (!mIsCompleted) return "border-gray-200 bg-white text-gray-700";
                        if (w !== team) return "border-gray-200 bg-gray-50 text-gray-400";
                        return strong ? "border-green-300 bg-green-50 text-green-700" : "border-green-200 bg-green-50/50 text-green-600";
                      };
                      return (
                        <div key={m.id} className="flex items-center gap-2 border-b border-gray-100 px-2 py-1.5 last:border-b-0 sm:gap-3 sm:px-3">
                          <div className="w-11 shrink-0 sm:w-12">
                            {hasCourt ? (
                              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black text-white sm:text-[10px] ${color.bg}`}>Lap. {m.courtNumber}</span>
                            ) : (
                              <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-black text-gray-400 sm:text-[10px]">Belum</span>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-1.5">
                            <div className="min-w-0 text-right">
                              <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted ? (m.winnerTeam === 1 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team1Player1Id)}</p>
                              <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted ? (m.winnerTeam === 1 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team1Player2Id)}</p>
                            </div>
                            <ShuttlecockIcon size={14} className="shrink-0 text-green-500" />
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className={`inline-flex h-6 w-7 items-center justify-center rounded-md border text-[11px] font-bold sm:h-7 sm:w-8 sm:text-xs ${winCls(g1w, 1, true)}`}>{m.scoreTeam1 || 0}</span>
                            {isTwoGame && (
                              <span className={`inline-flex h-6 w-7 items-center justify-center rounded-md border text-[11px] font-bold sm:h-7 sm:w-8 sm:text-xs ${winCls(g2w, 1, false)}`}>{m.scoreTeam1Game2 || 0}</span>
                            )}
                            {hasG3 && (
                              <span className={`inline-flex h-6 w-7 items-center justify-center rounded-md border text-[11px] font-bold sm:h-7 sm:w-8 sm:text-xs ${winCls(g3w, 1, false)}`}>{m.scoreTeam1Game3 || 0}</span>
                            )}
                          </div>
                          <div className="shrink-0 text-[10px] font-black text-gray-300 sm:text-xs">VS</div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className={`inline-flex h-6 w-7 items-center justify-center rounded-md border text-[11px] font-bold sm:h-7 sm:w-8 sm:text-xs ${winCls(g1w, 2, true)}`}>{m.scoreTeam2 || 0}</span>
                            {isTwoGame && (
                              <span className={`inline-flex h-6 w-7 items-center justify-center rounded-md border text-[11px] font-bold sm:h-7 sm:w-8 sm:text-xs ${winCls(g2w, 2, false)}`}>{m.scoreTeam2Game2 || 0}</span>
                            )}
                            {hasG3 && (
                              <span className={`inline-flex h-6 w-7 items-center justify-center rounded-md border text-[11px] font-bold sm:h-7 sm:w-8 sm:text-xs ${winCls(g3w, 2, false)}`}>{m.scoreTeam2Game3 || 0}</span>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
                            <User size={14} className="shrink-0 text-blue-500" />
                            <div className="min-w-0">
                              <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted ? (m.winnerTeam === 2 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team2Player1Id)}</p>
                              <p className={`truncate text-[11px] sm:text-xs ${mIsCompleted ? (m.winnerTeam === 2 ? "font-bold text-gray-900" : m.winnerTeam === null ? "text-gray-700" : "text-gray-400") : "font-medium text-gray-700"}`}>{getName(m.team2Player2Id)}</p>
                            </div>
                          </div>
                          <div className="w-4 shrink-0 text-center">
                            {mIsCompleted ? (m.winnerTeam === null ? <span className="text-amber-500">SERI</span> : <span className="text-green-600">✓</span>) : <span className="text-gray-400">⏳</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      </div>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .hasil-akhir-page { min-height: 0 !important; }
          .no-print { display: none !important; }
          .hasil-akhir-page .max-w-5xl { max-width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
          .hasil-akhir-page .py-6 { padding-top: 2px !important; padding-bottom: 0 !important; }
          .hasil-akhir-page .py-4 { padding-top: 4px !important; padding-bottom: 2px !important; }
          .hasil-akhir-page .mt-4 { margin-top: 8px !important; }
          .hasil-akhir-page .mt-3 { margin-top: 3px !important; }
          .hasil-akhir-page .gap-6 { gap: 14px !important; }
          .hasil-akhir-page .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 4px !important; }
          .hasil-akhir-page .mb-2 { margin-bottom: 3px !important; }
          .hasil-akhir-page section { break-inside: avoid; }
          .hasil-akhir-page .py-1\.5 { padding-top: 1px !important; padding-bottom: 1px !important; }
          .hasil-akhir-page .text-\[34px\] { font-size: 2.25rem !important; }
          .hasil-akhir-page .h-9 { height: 2rem !important; }
          .hasil-akhir-page .w-9 { width: 2rem !important; }
          .hasil-akhir-page .text-base { font-size: 0.875rem !important; }
          .hasil-akhir-page .text-lg { font-size: 1rem !important; }
          .hasil-akhir-page .shadow-sm { box-shadow: none !important; }
          .hasil-akhir-page .h-44 { height: 7rem !important; }
          .hasil-akhir-page .w-44 { width: 7rem !important; }
        }
      `}</style>
    </div>
  );
}
