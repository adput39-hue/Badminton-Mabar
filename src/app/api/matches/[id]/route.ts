import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse-events";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  const fields = ["scheduleId","pbId","courtNumber","round","team1Player1Id","team1Player2Id","team2Player1Id","team2Player2Id","scoreTeam1","scoreTeam2","scoreTeam1Game2","scoreTeam2Game2","totalGames","winnerTeam","status","notes"];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  const match = await prisma.match.update({ where: { id }, data });
  broadcast(JSON.stringify({ type: "match-updated", match }));
  return NextResponse.json(match);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.match.delete({ where: { id } });
  broadcast(JSON.stringify({ type: "match-deleted", matchId: id }));
  return NextResponse.json({ ok: true });
}
