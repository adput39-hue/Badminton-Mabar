import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const [members, schedules, matches, attendances, mutasis, allMutasis] = await Promise.all([
    prisma.member.findMany({ where }),
    prisma.schedule.findMany({ where }),
    prisma.match.findMany({ where }),
    prisma.attendance.findMany(),
    prisma.kasMutasi.findMany({
      where: { ...where, type: "masuk" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.kasMutasi.findMany({ where }),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const recentPayments = mutasis.map((m) => ({
    id: m.id,
    memberId: m.memberId,
    memberName: m.memberId ? memberMap.get(m.memberId)?.name || "?" : "?",
    description: m.description,
    amount: m.amount,
    tanggal: m.tanggal,
  }));

  const kasMasuk = allMutasis.filter((m) => m.type === "masuk").reduce((sum, m) => sum + m.amount, 0);
  const kasKeluar = allMutasis.filter((m) => m.type === "keluar").reduce((sum, m) => sum + m.amount, 0);
  const kasSaldo = kasMasuk - kasKeluar;

  return NextResponse.json({
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.isActive).length,
    thisMonthSchedules: schedules.filter(
      (s) => s.date.toISOString().split("T")[0] >= monthStartStr && s.status !== "cancelled"
    ).length,
    completedMatches: matches.filter((m) => m.status === "completed").length,
    upcomingSchedules: schedules
      .filter((s) => s.date.toISOString().split("T")[0] >= today && s.status === "planned")
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5)
      .map((s) => ({ id: s.id, title: s.title, date: s.date, startTime: s.startTime })),
    topPlayers: [] as { id: string; name: string; count: number }[],
    recentPayments,
    kasSaldo,
  });
}
