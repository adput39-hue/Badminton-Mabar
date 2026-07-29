import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.date !== undefined) data.date = new Date(body.date);
    if (body.startTime !== undefined) data.startTime = body.startTime || null;
    if (body.endTime !== undefined) data.endTime = body.endTime || null;
    if (body.location !== undefined) data.location = body.location || null;
    if (body.maxParticipants !== undefined) data.maxParticipants = body.maxParticipants ?? 20;
    if (body.courts !== undefined) data.courts = body.courts || null;
    if (body.htm !== undefined) data.htm = body.htm ?? null;
    if (body.cockPrice !== undefined) data.cockPrice = Number(body.cockPrice) || 0;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
    if (body.status !== undefined) data.status = body.status || "planned";
    const schedule = await prisma.schedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : "";
    console.error("PUT /api/schedules/[id] error:", msg, stack);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
