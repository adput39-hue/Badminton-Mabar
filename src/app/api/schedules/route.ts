import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const schedules = await prisma.schedule.findMany({ where, orderBy: { date: "desc" } });
  return NextResponse.json(schedules);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const schedule = await prisma.schedule.create({
      data: {
        pbId,
        title: body.title,
        date: new Date(body.date),
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        location: body.location || null,
        maxParticipants: body.maxParticipants ?? 20,
        courts: body.courts || null,
        htm: body.htm ?? null,
        notes: body.notes || null,
        sparingOpponent: body.sparingOpponent || null,
        status: body.status || "planned",
        createdBy: body.createdBy || null,
      },
    });
    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("POST /api/schedules error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
