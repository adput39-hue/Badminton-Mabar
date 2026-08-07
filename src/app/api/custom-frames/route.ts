import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_SLOTS = 4;

function getPbId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("pbId") || request.headers.get("x-pb-id") || "default";
}

// GET daftar frame custom (global per pb), termasuk gambar untuk dirender
export async function GET(request: Request) {
  try {
    const pbId = getPbId(request);
    const rows = await prisma.customFrame.findMany({
      where: { pbId },
      orderBy: { slot: "asc" },
      select: { id: true, slot: true, image: true, updatedAt: true },
    });
    return NextResponse.json(
      rows.map((r) => ({ id: r.id, slot: r.slot, hasImage: !!r.image, image: r.image, updatedAt: r.updatedAt }))
    );
  } catch (error) {
    console.error("GET /api/custom-frames error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST upsert frame custom per slot (base64 PNG transparan)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slot = Number(body.slot);
    const image = body.image as string | undefined;
    if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SLOTS) {
      return NextResponse.json({ error: "slot harus 1-4" }, { status: 400 });
    }
    if (image && !/^data:image\/png;base64,/i.test(image)) {
      return NextResponse.json({ error: "Gambar harus PNG (transparan)" }, { status: 400 });
    }
    const pbId = getPbId(request);
    const existing = await prisma.customFrame.findUnique({ where: { pbId_slot: { pbId, slot } } });
    const row = existing
      ? await prisma.customFrame.update({ where: { id: existing.id }, data: { image: image ?? null } })
      : await prisma.customFrame.create({ data: { pbId, slot, image: image ?? null } });
    return NextResponse.json({ id: row.id, pbId: row.pbId, slot: row.slot, hasImage: !!row.image });
  } catch (error) {
    console.error("POST /api/custom-frames error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}