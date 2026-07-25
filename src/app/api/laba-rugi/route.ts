import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const pbId = request.headers.get("x-pb-id");
    if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

    const items = await prisma.labaRugi.findMany({
      where: { pbId },
      include: {
        schedule: true,
        cockBiaya: true,
        courtBiaya: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pbId = request.headers.get("x-pb-id");
    if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

    const body = await request.json();
    const { scheduleId } = body;
    if (!scheduleId) return NextResponse.json({ error: "scheduleId required" }, { status: 400 });

    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    const htm = schedule.htm || 0;
    let paidMembers: string[] = [];
    try {
      if (schedule.notes) {
        const parsed = JSON.parse(schedule.notes);
        if (Array.isArray(parsed.paidMembers)) paidMembers = parsed.paidMembers;
      }
    } catch {}
    const totalIncome = htm * paidMembers.length;

    const existing = await prisma.labaRugi.findUnique({ where: { scheduleId } });
    const profitLoss = totalIncome - (existing?.cockCost || 0) - (existing?.courtCost || 0);

    const data = {
      scheduleId,
      pbId,
      totalIncome,
      cockCost: existing?.cockCost || 0,
      courtCost: existing?.courtCost || 0,
      cockBiayaId: existing?.cockBiayaId || null,
      courtBiayaId: existing?.courtBiayaId || null,
      profitLoss,
    };

    const item = existing
      ? await prisma.labaRugi.update({ where: { id: existing.id }, data, include: { schedule: true, cockBiaya: true, courtBiaya: true } })
      : await prisma.labaRugi.create({ data, include: { schedule: true, cockBiaya: true, courtBiaya: true } });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
