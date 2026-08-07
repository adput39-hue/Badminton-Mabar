import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const card = await prisma.matchCard.findUnique({
    where: { matchId },
    select: { id: true, matchId: true, pbId: true, photo: true, createdAt: true },
  });
  if (!card) return NextResponse.json({ error: "Card tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ id: card.id, matchId: card.matchId, pbId: card.pbId, hasPhoto: !!card.photo, createdAt: card.createdAt });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  await prisma.matchCard.deleteMany({ where: { matchId } });
  return NextResponse.json({ ok: true });
}
