import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse-events";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["scheduleId","pbId","courtNumber","round","team1Player1Id","team1Player2Id","team2Player1Id","team2Player2Id","scoreTeam1","scoreTeam2","scoreTeam1Game2","scoreTeam2Game2","scoreTeam1Game3","scoreTeam2Game3","totalGames","winnerTeam","cockCount","status","notes"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    const match = await prisma.match.update({ where: { id }, data });
    broadcast(JSON.stringify({ type: "match-updated", match }));
    return NextResponse.json(match);
  } catch (error) {
    console.error("PUT /api/matches/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.match.delete({ where: { id } });
    broadcast(JSON.stringify({ type: "match-deleted", matchId: id }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/matches/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
