import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse-events";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const matches = await prisma.match.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(matches);
}

export async function POST(request: Request) {
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
      totalGames: body.totalGames ?? 1,
      winnerTeam: body.winnerTeam ?? null,
      status: body.status || "scheduled",
      notes: body.notes || null,
    },
  });
  broadcast(JSON.stringify({ type: "match-created", match }));
  return NextResponse.json(match, { status: 201 });
}
