import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const attendances = await prisma.attendance.findMany();
    return NextResponse.json(attendances);
  } catch (error) {
    console.error("GET /api/attendances error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const attendance = await prisma.attendance.create({
    data: {
      scheduleId: body.scheduleId,
      memberId: body.memberId,
      status: body.status,
      confirmedAt: body.confirmedAt ? new Date(body.confirmedAt) : new Date(),
    },
  });
  return NextResponse.json(attendance, { status: 201 });
}
