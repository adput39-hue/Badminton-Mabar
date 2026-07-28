import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const tournament = await prisma.tournament.findUnique({ where: { id }, include: { teams: { include: { players: true } } } });
    if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pbId = tournament.pbId;

    const teamA = tournament.teams.find((t) => t.id === body.team1Id);
    const teamB = tournament.teams.find((t) => t.id === body.team2Id);
    if (!teamA || !teamB) return NextResponse.json({ error: "Tim tidak ditemukan" }, { status: 400 });

    const teamAPlayers = teamA.players.map((p) => p.memberId);
    const teamBPlayers = teamB.players.map((p) => p.memberId);
    if (!teamAPlayers.includes(body.team1Player1Id) || !teamAPlayers.includes(body.team1Player2Id))
      return NextResponse.json({ error: "Pemain tidak terdaftar di tim A" }, { status: 400 });
    if (!teamBPlayers.includes(body.team2Player1Id) || !teamBPlayers.includes(body.team2Player2Id))
      return NextResponse.json({ error: "Pemain tidak terdaftar di tim B" }, { status: 400 });

    if (tournament.maxMatchPerTeam) {
      const matchCountA = await prisma.match.count({
        where: { schedule: { tournamentId: id }, OR: [{ team1Player1Id: { in: teamAPlayers } }, { team1Player2Id: { in: teamAPlayers } }, { team2Player1Id: { in: teamAPlayers } }, { team2Player2Id: { in: teamAPlayers } }] },
      });
      if (matchCountA >= tournament.maxMatchPerTeam)
        return NextResponse.json({ error: `Tim ${teamA.name} sudah mencapai batas maksimal ${tournament.maxMatchPerTeam} pertandingan` }, { status: 400 });
    }

    if (tournament.totalMatchGoal) {
      const totalMatches = await prisma.match.count({ where: { schedule: { tournamentId: id } } });
      if (totalMatches >= tournament.totalMatchGoal)
        return NextResponse.json({ error: `Total pertandingan sudah mencapai ${tournament.totalMatchGoal}` }, { status: 400 });
    }

    const schedule = await prisma.schedule.create({
      data: {
        pbId,
        title: `${tournament.name}: ${teamA.name} vs ${teamB.name} (${new Date().toLocaleDateString("id-ID")})`,
        date: new Date(),
        tournamentId: id,
        team1Id: body.team1Id,
        team2Id: body.team2Id,
        status: "planned",
        maxParticipants: 20,
        courts: body.courtNumber ? JSON.stringify([{ name: `Lapangan ${body.courtNumber}`, startTime: "", endTime: "" }]) : null,
      },
    });

    const match = await prisma.match.create({
      data: {
        scheduleId: schedule.id,
        pbId,
        courtNumber: body.courtNumber || null,
        round: 1,
        team1Player1Id: body.team1Player1Id,
        team1Player2Id: body.team1Player2Id,
        team2Player1Id: body.team2Player1Id,
        team2Player2Id: body.team2Player2Id,
        status: "scheduled",
      },
    });

    return NextResponse.json({ schedule, match }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tournaments/[id]/match error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
