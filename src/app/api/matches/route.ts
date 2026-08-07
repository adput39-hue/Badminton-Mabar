import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse-events";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryPbId = url.searchParams.get("pbId");
    const pbId = queryPbId || request.headers.get("x-pb-id");
    const ids = url.searchParams.get("ids");
    const where: Record<string, unknown> = pbId ? { pbId } : {};
    if (ids) where.id = { in: ids.split(",") };
    const matches = await prisma.match.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json(matches);
  } catch (error) {
    console.error("GET /api/matches error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const match = await prisma.match.create({
      data: {
        scheduleId: body.scheduleId,
        pbId,
        courtNumber: body.courtNumber ?? null,
        round: body.round ?? 1,
        team1Player1Id: body.team1Player1Id,
        team1Player2Id: body.team1Player2Id,
        team2Player1Id: body.team2Player1Id,
        team2Player2Id: body.team2Player2Id,
        scoreTeam1: body.scoreTeam1 ?? null,
        scoreTeam2: body.scoreTeam2 ?? null,
        scoreTeam1Game2: body.scoreTeam1Game2 ?? null,
        scoreTeam2Game2: body.scoreTeam2Game2 ?? null,
        scoreTeam1Game3: body.scoreTeam1Game3 ?? null,
        scoreTeam2Game3: body.scoreTeam2Game3 ?? null,
        totalGames: body.totalGames ?? 1,
        winnerTeam: body.winnerTeam ?? null,
        status: body.status || "scheduled",
        notes: body.notes || null,
      },
    });
    broadcast(JSON.stringify({ type: "match-created", match }));
    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    console.error("POST /api/matches error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
