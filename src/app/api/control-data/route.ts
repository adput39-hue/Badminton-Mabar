import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryPbId = url.searchParams.get("pbId");
  const pbId = queryPbId || request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  try {
    const schedules = await prisma.schedule.findMany({ where, orderBy: { date: "desc" } });
    const members = await prisma.member.findMany({ where, orderBy: { name: "asc" } });
    const matches = await prisma.match.findMany({ where, orderBy: { createdAt: "desc" } });
    const tournaments = await prisma.tournament.findMany({ where, orderBy: { createdAt: "desc" }, include: { teams: { include: { players: true } }, _count: { select: { schedules: true } } } });
    const teams = await prisma.team.findMany({ where: { tournament: { ...(pbId ? { pbId } : {}) } }, include: { players: true }, orderBy: { name: "asc" } });
    const safeMembers = members.map(({ photo, ...m }) => m);
    return NextResponse.json({ schedules, members: safeMembers, matches, tournaments, teams });
  } catch (error) {
    console.error("GET /api/control-data error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
