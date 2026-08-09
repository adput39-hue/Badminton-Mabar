"use client";

import { useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMatch, ApiSchedule, ApiMember } from "@/lib/api-types";
import { Clock, Radio, Timer, Star } from "lucide-react";
import CourtIcon from "@/components/court-icon";
import { LoadingSpinner } from "@/components/loading-spinner";

const courtColors = [
  { bg: "bg-green-500", border: "border-green-500", text: "text-green-600", badge: "bg-green-100 text-green-700", badgeIcon: "text-green-500", liveBadge: "bg-green-500 text-white" },
  { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600", badge: "bg-blue-100 text-blue-700", badgeIcon: "text-blue-500", liveBadge: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600", badge: "bg-purple-100 text-purple-700", badgeIcon: "text-purple-500", liveBadge: "bg-purple-500 text-white" },
  { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600", badge: "bg-amber-100 text-amber-700", badgeIcon: "text-amber-500", liveBadge: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", border: "border-rose-500", text: "text-rose-600", badge: "bg-rose-100 text-rose-700", badgeIcon: "text-rose-500", liveBadge: "bg-rose-500 text-white" },
];

export default function PapanLapanganPage() {
  const { items: schedules, loaded: schedulesLoaded } = useApi<ApiSchedule>("schedules");
  const { items: members, loaded: membersLoaded } = useApi<ApiMember>("members");
  const { items: matches, loaded: matchesLoaded } = useApi<ApiMatch>("matches");

  const today = new Date().toISOString().split("T")[0];
  const todaySchedules = schedules.filter((s) => s.date.split("T")[0] === today && s.status !== "cancelled");
  const selId = todaySchedules[0]?.id || "";
  const schedule = schedules.find((s) => s.id === selId);
  const noSchedule = todaySchedules.length === 0;

  const courts = useMemo(() => {
    if (!schedule?.courts) return [];
    try { return JSON.parse(schedule.courts) as { name: string; startTime: string; endTime: string }[]; } catch { return []; }
  }, [schedule]);

  const scheduleMatches = useMemo(() => matches.filter((m) => m.scheduleId === selId), [matches, selId]);

  function getName(id: string) { return members.find((m) => m.id === id)?.name || "—"; }

  if (!schedulesLoaded || !membersLoaded || !matchesLoaded) return <LoadingSpinner />;

  return (
    <div className="relative min-h-screen bg-[var(--color-bg)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] pb-6 pt-4 sm:pb-8 sm:pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <h1 className="text-xl font-bold text-white sm:text-2xl">Papan Lapangan</h1>
          <p className="mt-1 text-sm font-medium text-white/70">{schedule ? `${schedule.title} — ${schedule.location || ""}` : "Tidak ada jadwal hari ini"}</p>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {noSchedule ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
            <CourtIcon size={48} color="#d1d5db" />
            <p className="mt-3 text-sm text-gray-500">Belum ada jadwal mabar hari ini</p>
            <p className="text-xs text-gray-400">Buat jadwal dulu di menu Jadwal</p>
          </div>
        ) : courts.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-sm text-gray-500">Jadwal ini belum punya lapangan</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {courts.map((court, ci) => {
              const cMatches = scheduleMatches.filter((m) => m.courtNumber === ci + 1);
              const cDone = cMatches.filter((m) => m.status === "completed").length;
              const color = courtColors[ci % courtColors.length];
              const hasLive = cMatches.some((m) => (m.scoreTeam1 || 0) + (m.scoreTeam2 || 0) > 0);
              return (
                <div key={ci} className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${hasLive ? `${color.border} border-2` : "border-gray-200"}`}>
                  {hasLive && (
                    <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-bl-2xl ${color.bg}`}>
                      <Star className="h-4 w-4 text-white" fill="white" />
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${color.bg}`}>
                      <CourtIcon size={40} color="white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">{court.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{court.startTime.slice(0,5)} - {court.endTime.slice(0,5)}</span>
                      </div>
                      {hasLive ? (
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${color.liveBadge}`}>
                          <Radio className="h-3 w-3" /> LIVE
                        </span>
                      ) : cDone > 0 ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">SELESAI</span>
                      ) : (
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${color.badge}`}>
                          <Timer className={`h-3 w-3 ${color.badgeIcon}`} /> Belum Dimulai
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {cMatches.length === 0 ? (
                      <p className="py-2 text-center text-sm text-gray-400">Lapangan kosong</p>
                    ) : (
                      cMatches.map((m) => {
                        const isDone = m.status === "completed";
                        return (
                          <div key={m.id} className="rounded-lg border border-gray-100 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs text-gray-400">R{m.round}</span>
                              {isDone ? (
                                <span className="text-xs font-bold text-[var(--color-primary)]">{m.winnerTeam !== null ? `${m.scoreTeam1}-${m.scoreTeam2}` : "SERI"}</span>
                              ) : (
                                <span className="text-[10px] font-semibold text-gray-400">SIAP</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-sm">
                              <div className={`rounded-lg border-2 p-2 ${isDone && m.winnerTeam === 1 ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-gray-100"}`}>
                                <p className="font-medium">{getName(m.team1Player1Id)}</p>
                                <p className="text-xs text-gray-400">+</p>
                                <p className="font-medium">{getName(m.team1Player2Id)}</p>
                              </div>
                              <div className={`rounded-lg border-2 p-2 ${isDone && m.winnerTeam === 2 ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-gray-100"}`}>
                                <p className="font-medium">{getName(m.team2Player1Id)}</p>
                                <p className="text-xs text-gray-400">+</p>
                                <p className="font-medium">{getName(m.team2Player2Id)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className={`flex items-center gap-2 text-sm font-medium ${hasLive ? color.text : "text-gray-500"}`}>
                      <CourtIcon size={16} color={hasLive ? "currentColor" : "#9ca3af"} />
                      {cMatches.length} pertandingan · {cDone} selesai
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
