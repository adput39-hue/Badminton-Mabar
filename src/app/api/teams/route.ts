import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });
  const teams = await prisma.team.findMany({
    where: { tournament: { pbId } },
    include: { players: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.memberIds?.length) {
      const existing = await prisma.teamPlayer.findMany({
        where: { memberId: { in: body.memberIds }, team: { tournamentId: body.tournamentId } },
        include: { team: { select: { name: true } } },
      });
      if (existing.length) {
        const names = existing.map((e) => `${e.memberId} (sudah di tim ${e.team.name})`);
        return NextResponse.json({ error: `Pemain sudah terdaftar di tim lain: ${names.join(", ")}` }, { status: 409 });
      }
    }

    const team = await prisma.team.create({
      data: { tournamentId: body.tournamentId, name: body.name, color: body.color || "#0d9488", icon: body.icon || null },
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
