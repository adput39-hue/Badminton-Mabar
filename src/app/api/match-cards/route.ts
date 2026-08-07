import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export async function runMatchCardCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const deleted = await prisma.matchCard.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (deleted.count > 0) console.log(`[match-cards] cleanup: deleted ${deleted.count} expired cards`);
  return deleted.count;
}

function getPbId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("pbId") || request.headers.get("x-pb-id") || "default";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = body.matchId as string;
    const photo = body.photo as string | undefined;
    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }
    const pbId = getPbId(request);
    const existing = await prisma.matchCard.findUnique({ where: { matchId } });
    const card = existing
      ? await prisma.matchCard.update({
          where: { matchId },
          data: { photo: photo ?? existing.photo, pbId },
        })
      : await prisma.matchCard.create({
          data: { matchId, pbId, photo: photo ?? null },
        });
    return NextResponse.json({ id: card.id, matchId: card.matchId, pbId: card.pbId, hasPhoto: !!card.photo, createdAt: card.createdAt }, { status: 201 });
  } catch (error) {
    console.error("POST /api/match-cards error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await runMatchCardCleanup();
    const pbId = getPbId(request);
    const where = pbId === "default" ? Prisma.sql`1=1` : Prisma.sql`pb_id = ${pbId}`;
    const rows = await prisma.$queryRaw<{ id: string; match_id: string; pb_id: string; has_photo: boolean; created_at: Date }[]>`
      SELECT id, match_id, pb_id, (photo IS NOT NULL) AS has_photo, created_at
      FROM match_cards
      WHERE ${where}
      ORDER BY created_at DESC`;
    return NextResponse.json(
      rows.map((r) => ({ id: r.id, matchId: r.match_id, pbId: r.pb_id, hasPhoto: r.has_photo, createdAt: r.created_at }))
    );
  } catch (error) {
    console.error("GET /api/match-cards error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
