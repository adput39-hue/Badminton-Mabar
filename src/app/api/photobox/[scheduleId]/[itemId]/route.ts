import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ scheduleId: string; itemId: string }> }) {
  try {
    const { scheduleId, itemId } = await params;
    const item = await prisma.photoBoxItem.findFirst({
      where: { id: itemId, photoBox: { scheduleId } },
    });
    if (!item) return new NextResponse("Not Found", { status: 404 });
    await prisma.photoBoxItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/photobox item error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}