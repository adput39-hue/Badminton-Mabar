import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const team = await prisma.team.create({
      data: { tournamentId: body.tournamentId, name: body.name, color: body.color || "#0d9488" },
      include: { players: true },
    });
    if (body.memberIds?.length) {
      await prisma.teamPlayer.createMany({
        data: body.memberIds.map((memberId: string) => ({ teamId: team.id, memberId })),
      });
    }
    const result = await prisma.team.findUnique({ where: { id: team.id }, include: { players: true } });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/teams error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
