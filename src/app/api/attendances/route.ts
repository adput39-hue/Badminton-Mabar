import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pbId = url.searchParams.get("pbId");
    const scheduleId = url.searchParams.get("scheduleId");
    const where = scheduleId
      ? { scheduleId }
      : pbId
        ? { schedule: { pbId } }
        : {};
    const attendances = await prisma.attendance.findMany({ where });
    return NextResponse.json(attendances);
  } catch (error) {
    console.error("GET /api/attendances error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  try {
    if (!body.scheduleId || !body.memberId) {
      return NextResponse.json({ error: "scheduleId dan memberId wajib diisi" }, { status: 400 });
    }
    const existing = await prisma.attendance.findUnique({
      where: { scheduleId_memberId: { scheduleId: body.scheduleId, memberId: body.memberId } },
    });
    if (existing) {
      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: body.status || "hadir",
          confirmedAt: body.confirmedAt ? new Date(body.confirmedAt) : new Date(),
        },
      });
      return NextResponse.json(attendance, { status: 200 });
    }
    const attendance = await prisma.attendance.create({
      data: {
        scheduleId: body.scheduleId,
        memberId: body.memberId,
        status: body.status || "hadir",
        confirmedAt: body.confirmedAt ? new Date(body.confirmedAt) : new Date(),
      },
    });
    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    console.error("POST /api/attendances error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
