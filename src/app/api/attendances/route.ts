import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const attendances = await prisma.attendance.findMany();
  return NextResponse.json(attendances);
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
