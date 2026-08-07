import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id }, select: { photo: true } });
  if (!member?.photo) return new NextResponse("Not Found", { status: 404 });
  const m = member.photo.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
  const buf = Buffer.from(m ? m[2] : member.photo, "base64");
  const type = m ? m[1] : "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buf.length),
    },
  });
}
