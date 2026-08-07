import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const card = await prisma.matchCard.findUnique({ where: { matchId }, select: { photo: true } });
  if (!card?.photo) return new NextResponse("Not Found", { status: 404 });
  const m = card.photo.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
  const buf = Buffer.from(m ? m[2] : card.photo, "base64");
  const type = m ? m[1] : "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(buf.length),
    },
  });
}
