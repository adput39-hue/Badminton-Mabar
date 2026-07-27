import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pbId = request.headers.get("x-pb-id");
    const tournament = await prisma.tournament.findFirst({
      where: { id, ...(pbId ? { pbId } : {}) },
      include: { teams: true },
    });
    if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (tournament.teams.length < 2) return NextResponse.json({ error: "Minimal 2 tim" }, { status: 400 });

    const teamIds = tournament.teams.map((t) => t.id);
    const pairs: { team1Id: string; team2Id: string }[] = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        pairs.push({ team1Id: teamIds[i], team2Id: teamIds[j] });
      }
    }

    const existing = await prisma.schedule.findMany({ where: { tournamentId: id } });
    const existingPairs = new Set(existing.map((s) => [s.team1Id, s.team2Id].sort().join(":")));

    let created = 0;
    for (const pair of pairs) {
      const key = [pair.team1Id, pair.team2Id].sort().join(":");
      if (existingPairs.has(key)) continue;
      const team1 = tournament.teams.find((t) => t.id === pair.team1Id);
      const team2 = tournament.teams.find((t) => t.id === pair.team2Id);
      await prisma.schedule.create({
        data: {
          pbId: tournament.pbId,
          title: `${tournament.name}: ${team1?.name} vs ${team2?.name}`,
          date: new Date(),
          tournamentId: id,
          team1Id: pair.team1Id,
          team2Id: pair.team2Id,
          status: "planned",
          maxParticipants: 20,
        },
      });
      created++;
    }

    return NextResponse.json({ created, total: pairs.length });
  } catch (error) {
    console.error("POST /api/tournaments/[id]/generate error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
