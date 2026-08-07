import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function runPhotoBoxCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const expired = await prisma.photoBox.findMany({
    where: { updatedAt: { lt: cutoff } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  const ids = expired.map((p) => p.id);
  const deleted = await prisma.photoBox.deleteMany({ where: { id: { in: ids } } });
  if (deleted.count > 0) console.log(`[photobox] cleanup: deleted ${deleted.count} expired boxes`);
  return deleted.count;
}

export async function GET() {
  try {
    const count = await runPhotoBoxCleanup();
    return NextResponse.json({ ok: true, deleted: count });
  } catch (error) {
    console.error("GET /api/photobox/cleanup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}