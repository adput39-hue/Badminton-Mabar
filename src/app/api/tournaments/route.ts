import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const tournaments = await prisma.tournament.findMany({
    where,
    include: { teams: { include: { players: true } }, _count: { select: { schedules: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tournaments);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const tournament = await prisma.tournament.create({
      data: { pbId, name: body.name, status: body.status || "planned", totalMatchGoal: body.totalMatchGoal ?? null, maxMatchPerTeam: body.maxMatchPerTeam ?? null, gameFormat: body.gameFormat ?? "1x30", courts: body.courts ?? null },
    });
    return NextResponse.json(tournament, { status: 201 });
  } catch (error) {
    console.error("POST /api/tournaments error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
