import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateOnly, todayDateOnly } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const pbId = request.headers.get("x-pb-id");
    const where = pbId ? { pbId } : {};
    const members = await prisma.member.findMany({ where });
    const schedules = await prisma.schedule.findMany({ where });
    const matches = await prisma.match.findMany({ where });
    const attendances = await prisma.attendance.findMany();
    const mutasis = await prisma.kasMutasi.findMany({
      where: { ...where, type: "masuk", void: 0 },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const allMutasis = await prisma.kasMutasi.findMany({ where: { ...where, void: 0 } });

    const today = todayDateOnly();
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = toDateOnly(monthStart);

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
        (s) => toDateOnly(s.date) >= monthStartStr && s.status !== "cancelled"
      ).length,
      completedMatches: matches.filter((m) => m.status === "completed").length,
      upcomingSchedules: schedules
        .filter((s) => toDateOnly(s.date) >= today && s.status === "planned")
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5)
        .map((s) => ({ id: s.id, title: s.title, date: s.date, startTime: s.startTime })),
      topPlayers: [] as { id: string; name: string; count: number }[],
      recentPayments,
      kasSaldo,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
