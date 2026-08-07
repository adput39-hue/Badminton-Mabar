import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPhotoBoxCleanup } from "../cleanup/route";

export const dynamic = "force-dynamic";

const ALLOWED_FRAMES = ["maya", "zasar", "plaid", "sticker", "custom1", "custom2", "custom3", "custom4"];

function getPbId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("pbId") || request.headers.get("x-pb-id") || "default";
}

async function getOrCreateBox(scheduleId: string, pbId: string) {
  const existing = await prisma.photoBox.findUnique({ where: { scheduleId } });
  if (existing) return existing;
  return prisma.photoBox.create({ data: { scheduleId, pbId } });
}

// GET list item metadata (tanpa payload foto)
export async function GET(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  try {
    await runPhotoBoxCleanup();
    const { scheduleId } = await params;
    const pbId = getPbId(request);
    const box = await prisma.photoBox.findUnique({
      where: { scheduleId },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!box) return NextResponse.json([]);
    const rows = box.items.map((it) => ({
      id: it.id,
      frameId: it.frameId,
      hasPhoto: !!it.photo,
      createdAt: it.createdAt,
      url: `/api/photobox/${scheduleId}/${it.id}/photo`,
    }));
    return NextResponse.json({ pbId, boxId: box.id, items: rows });
  } catch (error) {
    console.error("GET /api/photobox/[scheduleId] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST simpan / update foto pada satu frame slot
export async function POST(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  try {
    const { scheduleId } = await params;
    const body = await request.json();
    const frameId = body.frameId as string;
    const photo = body.photo as string | undefined;
    if (!ALLOWED_FRAMES.includes(frameId)) {
      return NextResponse.json({ error: "frameId tidak valid" }, { status: 400 });
    }
    const pbId = getPbId(request);
    const box = await getOrCreateBox(scheduleId, pbId);
    const existing = await prisma.photoBoxItem.findFirst({
      where: { photoBoxId: box.id, frameId },
    });
    const item = existing
      ? await prisma.photoBoxItem.update({ where: { id: existing.id }, data: { photo: photo ?? null } })
      : await prisma.photoBoxItem.create({ data: { photoBoxId: box.id, frameId, photo: photo ?? null } });
    return NextResponse.json({
      id: item.id,
      frameId: item.frameId,
      hasPhoto: !!item.photo,
      url: `/api/photobox/${scheduleId}/${item.id}/photo`,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/photobox/[scheduleId] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}