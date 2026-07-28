import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  try {
    const [schedules, members, matches, tournaments, teams] = await Promise.all([
      prisma.schedule.findMany({ where, orderBy: { date: "desc" } }),
      prisma.member.findMany({ where, orderBy: { name: "asc" } }),
      prisma.match.findMany({ where, orderBy: { createdAt: "desc" } }),
      prisma.tournament.findMany({ where, orderBy: { createdAt: "desc" }, include: { teams: { include: { players: true } }, _count: { select: { schedules: true } } } }),
      prisma.team.findMany({ where: { tournament: { ...(pbId ? { pbId } : {}) } }, include: { players: true }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ schedules, members, matches, tournaments, teams });
  } catch (error) {
    console.error("GET /api/control-data error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
