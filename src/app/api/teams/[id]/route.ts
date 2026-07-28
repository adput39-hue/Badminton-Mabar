import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const team = await prisma.team.update({ where: { id }, data: { name: body.name, color: body.color, icon: body.icon ?? undefined }, include: { players: true } });
    if (body.memberIds) {
      await prisma.teamPlayer.deleteMany({ where: { teamId: id } });
      if (body.memberIds.length) {
        await prisma.teamPlayer.createMany({
          data: body.memberIds.map((memberId: string) => ({ teamId: id, memberId })),
        });
      }
    }
    const result = await prisma.team.findUnique({ where: { id }, include: { players: true } });
    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/teams/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.teamPlayer.deleteMany({ where: { teamId: id } });
    await prisma.team.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/teams/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
