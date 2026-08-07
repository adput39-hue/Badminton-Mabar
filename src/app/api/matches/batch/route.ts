import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse-events";

export async function POST(request: Request) {
  const body = await request.json();
  const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
  const matchesData = body.matches as Record<string, unknown>[];
  if (!Array.isArray(matchesData) || matchesData.length === 0) {
    return NextResponse.json({ error: "matches array required" }, { status: 400 });
  }
  const created = await prisma.$transaction(
    matchesData.map((m) =>
      prisma.match.create({
        data: {
          scheduleId: m.scheduleId as string,
          pbId,
          courtNumber: (m.courtNumber as number) ?? null,
          round: (m.round as number) ?? 1,
          team1Player1Id: m.team1Player1Id as string,
          team1Player2Id: m.team1Player2Id as string,
          team2Player1Id: m.team2Player1Id as string,
          team2Player2Id: m.team2Player2Id as string,
          scoreTeam1: (m.scoreTeam1 as number) ?? null,
          scoreTeam2: (m.scoreTeam2 as number) ?? null,
          scoreTeam1Game2: (m.scoreTeam1Game2 as number) ?? null,
          scoreTeam2Game2: (m.scoreTeam2Game2 as number) ?? null,
          scoreTeam1Game3: (m.scoreTeam1Game3 as number) ?? null,
          scoreTeam2Game3: (m.scoreTeam2Game3 as number) ?? null,
          totalGames: (m.totalGames as number) ?? 1,
          winnerTeam: (m.winnerTeam as number) ?? null,
          status: (m.status as string) || "scheduled",
          notes: (m.notes as string) || null,
        },
      })
    )
  );
  for (const match of created) {
    broadcast(JSON.stringify({ type: "match-created", match }));
  }
  return NextResponse.json(created, { status: 201 });
}
