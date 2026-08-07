import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ scheduleId: string; itemId: string }> }) {
  try {
    const { scheduleId, itemId } = await params;
    const item = await prisma.photoBoxItem.findFirst({
      where: { id: itemId, photoBox: { scheduleId } },
    });
    if (!item?.photo) return new NextResponse("Not Found", { status: 404 });
    const m = item.photo.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
    const buf = Buffer.from(m ? m[2] : item.photo, "base64");
    const type = m ? m[1] : "image/png";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="photobox-${item.id.slice(0, 8)}.png"`,
      },
    });
  } catch (error) {
    console.error("GET /api/photobox photo error:", error);
    return new NextResponse("Server Error", { status: 500 });
  }
}