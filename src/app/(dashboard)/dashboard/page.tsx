"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Calendar, Swords, Wallet, TrendingUp, Clock, MapPin, ArrowRight, PlusCircle, CalendarPlus, Trophy, CreditCard, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { getClientPbId } from "@/lib/tenant";

interface DashboardData {
  totalMembers: number; activeMembers: number; thisMonthSchedules: number;
  completedMatches: number; upcomingSchedules: { id: string; title: string; date: string; startTime: string; endTime?: string; location?: string; maxParticipants?: number }[];
  topPlayers: { id: string; name: string; count: number }[];
}

const dayNames = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];
const monthNames = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OKT", "NOV", "DES"];

function getDateBadge(dateStr: string) {
  const d = new Date(dateStr);
  return { day: dayNames[d.getDay()], date: d.getDate(), month: monthNames[d.getMonth()] };
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ fullName: string; role: string; level?: { menus: string[] } } | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const hasDashboardAccess = user?.role === "superadmin" || user?.level?.menus?.includes("dashboard");

  useEffect(() => {
    if (!hasDashboardAccess) return;
    const headers = { "Content-Type": "application/json", "x-pb-id": getClientPbId() || "" };
    fetch("/api/dashboard", { headers }).then((r) => r.json()).then(setData).catch(console.error);
    fetch("/api/members", { headers }).then((r) => r.json()).then(setMembers).catch(console.error);
    fetch("/api/matches", { headers }).then((r) => r.json()).then(setMatches).catch(console.error);
    fetch("/api/schedules", { headers }).then((r) => r.json()).then(setSchedules).catch(console.error);
    fetch("/api/attendances", { headers }).then((r) => r.json()).then(setAttendances).catch(console.error);
  }, [hasDashboardAccess]);

  const hadir = attendances.filter((a) => a.status === "hadir").length;
  const izin = attendances.filter((a) => a.status === "izin").length;
  const alpha = attendances.filter((a) => a.status === "alpha").length;
  const totalAtt = hadir + izin + alpha;
  const attendanceRate = totalAtt > 0 ? Math.round((hadir / totalAtt) * 100) : 0;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const internalMembers = members.filter((m: any) => m.type === "1" || !m.type);

  const thisMonthActivities = (() => {
    const seen = new Set<string>();
    schedules.forEach((s: any) => {
      const d = new Date(s.date);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear && s.status !== "cancelled" && !seen.has(s.id)) {
        seen.add(s.id);
      }
    });
    return seen.size;
  })();

  const upcomingSchedules = (() => {
    const seen = new Set<string>();
    const result: any[] = [];
    [...schedules]
      .filter((s: any) => s.status !== "cancelled")
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((s: any) => {
        if (seen.has(s.id)) return;
        const key = `${new Date(s.date).toISOString().slice(0, 10)}|${(s.title || "").toLowerCase().trim()}|${(s.sparingOpponent || "").toLowerCase().trim()}`;
        if (seen.has(key)) return;
        seen.add(s.id);
        seen.add(key);
        let courtTime = s.startTime;
        try {
          if (s.notes) {
            const notes = JSON.parse(s.notes);
            if (notes.courts?.length > 0) courtTime = notes.courts[0].startTime;
          }
          if (!courtTime && s.courts) {
            const courts = JSON.parse(s.courts);
            if (Array.isArray(courts) && courts.length > 0) courtTime = courts[0].startTime;
          }
        } catch {}
        result.push({ ...s, courtTime });
      });
    return result.slice(0, 3);
  })();

  const recentMatches = matches.filter((m) => m.status === "completed").slice(0, 3);
  const recentMembers = [...internalMembers].sort((a: any, b: any) => new Date(b.createdAt || b.joinedAt || 0).getTime() - new Date(a.createdAt || a.joinedAt || 0).getTime()).slice(0, 4);

  const nextSchedule = upcomingSchedules[0];
  const nextDate = nextSchedule ? getDateBadge(nextSchedule.date) : null;

  if (user && !hasDashboardAccess) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#ccfbf1] text-4xl">🏸</div>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Selamat Datang, {user.fullName}!</h1>
          <p className="mt-2 text-sm text-gray-500">Silakan gunakan menu di sidebar untuk memulai.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {!data ? (
        <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0d9488] border-t-transparent" /></div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={<Users className="h-8 w-8 text-[#0d9488]/20" />} value={internalMembers.length} label="Total Anggota" sub="Terdaftar" />
            <StatCard icon={<Calendar className="h-8 w-8 text-[#0d9488]/20" />} value={thisMonthActivities} label="Main Bareng Bulan Ini" sub="Kegiatan" />
            <StatCard icon={<Clock className="h-8 w-8 text-[#0d9488]/20" />} value={nextDate ? `${nextDate.date} ${nextDate.month}` : "—"} label="Jadwal Berikutnya" sub={nextSchedule ? `${nextSchedule.courtTime?.slice(0,5) || ""}` : ""} />
            <StatCard icon={<Wallet className="h-8 w-8 text-[#0d9488]/20" />} value="Rp0" label="Kas PB" sub="Saldo saat ini" />
            <StatCard icon={<Swords className="h-8 w-8 text-[#0d9488]/20" />} value={data.completedMatches} label="Match Bulan Ini" sub="Pertandingan" />
          </div>

          {/* Main Grid */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Jadwal Terdekat */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Calendar className="h-4 w-4 text-[#0d9488]" /> Jadwal Main Bareng Terdekat</h2>
                <Link href="/schedules" className="text-xs text-gray-500 hover:text-[#0d9488]">Lihat Semua</Link>
              </div>
              <div className="space-y-3">
                {upcomingSchedules.map((s: any) => {
                  const badge = getDateBadge(s.date);
                  const attCount = attendances.filter((a: any) => a.scheduleId === s.id && a.status === "hadir").length;
                  const maxP = s.maxParticipants || 20;
                  const full = attCount >= maxP;
                  return (
                    <div key={s.id} className="flex gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-[#0d9488] text-white">
                        <span className="text-[10px] font-bold">{badge.day}</span>
                        <span className="text-lg font-bold leading-none">{badge.date}</span>
                        <span className="text-[9px]">{badge.month}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                        <p className="text-xs text-gray-500">🕐 {s.courtTime?.slice(0,5) || s.startTime?.slice(0,5) || "—"}{s.endTime ? ` - ${s.endTime.slice(0,5)}` : ""}</p>
                        {s.location && <p className="text-xs text-gray-500 truncate">📍 {s.location}</p>}
                      </div>
                      <div className="flex flex-col items-end justify-center gap-1">
                        <span className="text-xs text-gray-500">{attCount}/{maxP} Terisi</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${full ? "bg-amber-100 text-amber-700" : "bg-[#ccfbf1] text-[#0d9488]"}`}>{full ? "Penuh" : "Akan Datang"}</span>
                      </div>
                    </div>
                  );
                })}
                {upcomingSchedules.length === 0 && <p className="py-4 text-center text-xs text-gray-400">Belum ada jadwal</p>}
              </div>
            </div>

            {/* Match Terakhir */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Swords className="h-4 w-4 text-[#0d9488]" /> Match Terakhir</h2>
                <Link href="/matches" className="text-xs text-gray-500 hover:text-[#0d9488]">Lihat Semua</Link>
              </div>
              <div className="space-y-4">
                {recentMatches.length === 0 && schedules.filter((s: any) => s.status === "completed").length === 0 ? (
                  <div className="py-8 text-center"><Swords className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-2 text-xs text-gray-400">Belum ada pertandingan</p></div>
                ) : recentMatches.map((m: any) => {
                  const sch = schedules.find((s: any) => s.id === m.scheduleId);
                  return (
                    <div key={m.id}>
                      <p className="mb-2 text-xs font-semibold text-gray-700">{sch?.title || "Match"}</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-[#0d9488] flex items-center justify-center text-white text-xs font-bold">{members.find((x: any) => x.id === m.team1Player1Id)?.name?.charAt(0) || "?"}</div>
                            <span className="text-xs font-medium text-gray-900">{members.find((x: any) => x.id === m.team1Player1Id)?.name || "—"}</span>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-gray-900">{m.scoreTeam1 ?? 0} - {m.scoreTeam2 ?? 0}</p>
                            <p className="text-[10px] text-gray-400">Court {m.courtNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-900">{members.find((x: any) => x.id === m.team2Player1Id)?.name || "—"}</span>
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold">{members.find((x: any) => x.id === m.team2Player1Id)?.name?.charAt(0) || "?"}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-[#0d9488] flex items-center justify-center text-white text-xs font-bold">{members.find((x: any) => x.id === m.team1Player2Id)?.name?.charAt(0) || "?"}</div>
                            <span className="text-xs font-medium text-gray-900">{members.find((x: any) => x.id === m.team1Player2Id)?.name || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-900">{members.find((x: any) => x.id === m.team2Player2Id)?.name || "—"}</span>
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold">{members.find((x: any) => x.id === m.team2Player2Id)?.name?.charAt(0) || "?"}</div>
                          </div>
                        </div>
                        <div className="text-center">
                          <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold ${m.winnerTeam === 1 ? "bg-[#ccfbf1] text-[#0d9488]" : m.winnerTeam === 2 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                            {m.winnerTeam === 1 ? "Menang" : m.winnerTeam === 2 ? "Kalah" : "Seri"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kehadiran + Pembayaran */}
            <div className="space-y-6">
              {/* Donut Chart */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900"><TrendingUp className="h-4 w-4 text-[#0d9488]" /> Kehadiran Bulan Ini</h2>
                <div className="flex items-center gap-6">
                  <div className="relative h-28 w-28 flex-shrink-0">
                    <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#ccfbf1" strokeWidth="12" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#0d9488" strokeWidth="12" strokeDasharray={`${attendanceRate * 2.51} 251`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">{attendanceRate}%</span>
                      <span className="text-[9px] text-gray-500">Rata-rata Kehadiran</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#0d9488]" /> Hadir <span className="ml-auto font-semibold">{hadir}</span></div>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Tidak Hadir <span className="ml-auto font-semibold">{alpha}</span></div>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Izin <span className="ml-auto font-semibold">{izin}</span></div>
                    <div className="border-t pt-1 text-gray-500">Total Kegiatan <span className="ml-auto font-semibold text-gray-900">{thisMonthActivities}</span></div>
                  </div>
                </div>
              </div>

              {/* Pembayaran */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><CreditCard className="h-4 w-4 text-[#0d9488]" /> Pembayaran Terbaru</h2>
                  <Link href="/settings" className="text-xs text-gray-500 hover:text-[#0d9488]">Lihat Semua</Link>
                </div>
                <div className="space-y-3">
                  {recentMembers.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#ccfbf1] flex items-center justify-center text-[#0d9488] text-xs font-bold">{m.name.charAt(0)}</div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{m.name}</p>
                          <p className="text-[10px] text-gray-500">Main Bareng</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-900">Rp40.000</p>
                        <span className="rounded-full bg-[#ccfbf1] px-2 py-0.5 text-[10px] font-medium text-[#0d9488]">Lunas</span>
                      </div>
                    </div>
                  ))}
                  {recentMembers.length === 0 && <p className="py-2 text-center text-xs text-gray-400">Belum ada data</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Anggota Aktif Terbaru */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Users className="h-4 w-4 text-[#0d9488]" /> Anggota Aktif Terbaru</h2>
              <Link href="/members" className="text-xs text-gray-500 hover:text-[#0d9488]">Lihat Semua</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentMembers.map((m: any) => (
                <div key={m.id} className="rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-[#ccfbf1] flex items-center justify-center text-[#0d9488] text-lg font-bold">{m.name.charAt(0)}</div>
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0d9488] text-white text-xs">+</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                      <p className="text-xs text-[#0d9488]">{m.class === "A" || m.class === "B" ? "Advanced" : m.class === "C" || m.class === "D" ? "Intermediate" : "Beginner"}</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-[10px] text-gray-500">Bergabung</p>
                    <p className="text-xs font-medium text-gray-700">{new Date(m.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
              ))}
              {recentMembers.length === 0 && <p className="py-4 text-center text-xs text-gray-400 col-span-4">Belum ada anggota</p>}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction icon={<Users className="h-6 w-6" />} label="Tambah Anggota" href="/members" />
            <QuickAction icon={<CalendarPlus className="h-6 w-6" />} label="Buat Jadwal" href="/schedules" />
            <QuickAction icon={<Trophy className="h-6 w-6" />} label="Buat Match" href="/matches" />
            <QuickAction icon={<CreditCard className="h-6 w-6" />} label="Catat Pembayaran" href="/settings" />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, sub }: { icon: React.ReactNode; value: string | number; label: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="absolute right-3 top-3 opacity-20">{icon}</div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ccfbf1] text-[#0d9488]">{icon}</div>
      <p className="text-xs font-medium text-gray-700 text-center">{label}</p>
    </Link>
  );
}
