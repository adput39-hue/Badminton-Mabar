import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const { scheduleId, attendances } = body as { scheduleId: string; attendances: { memberId: string; status: string }[] };
  if (!scheduleId || !Array.isArray(attendances)) {
    return NextResponse.json({ error: "scheduleId and attendances array required" }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { scheduleId } });
    const created = await Promise.all(
      attendances.map((a) =>
        tx.attendance.create({
          data: { scheduleId, memberId: a.memberId, status: a.status, confirmedAt: new Date() },
        })
      )
    );
    return created;
  });
  return NextResponse.json(result, { status: 201 });
}
