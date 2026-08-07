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

    // Auto-calculate income from actual "Bayar HTM" kas entries (per-member rate already applied)
    const mutations = await prisma.kasMutasi.findMany({
      where: { OR: [{ scheduleId }, { reference: scheduleId }], void: 0 },
      include: { biaya: true },
    });

    const bayarIncome = mutations
      .filter((m) => m.type === "masuk" && m.description?.startsWith("Bayar HTM"))
      .reduce((sum, m) => sum + (m.amount || 0), 0);

    // Fallback estimate for legacy schedules without kas entries
    const totalIncome = bayarIncome > 0 ? bayarIncome : htm * paidMembers.length;

    let autoCockCost = 0;
    let autoCourtCost = 0;
    let autoCockBiayaId: string | null = null;
    let autoCourtBiayaId: string | null = null;

    for (const m of mutations) {
      if (m.biaya?.type === "cock") {
        autoCockCost += m.amount;
        autoCockBiayaId = m.biayaId;
      } else if (m.biaya?.type === "court") {
        autoCourtCost += m.amount;
        autoCourtBiayaId = m.biayaId;
      }
    }

    const existing = await prisma.labaRugi.findUnique({ where: { scheduleId } });

    // Use auto from mutations if available, otherwise keep existing/manual
    const cockCost = autoCockCost > 0 ? autoCockCost : (existing?.cockCost || 0);
    const courtCost = autoCourtCost > 0 ? autoCourtCost : (existing?.courtCost || 0);
    const cockBiayaId = autoCockBiayaId || existing?.cockBiayaId || null;
    const courtBiayaId = autoCourtBiayaId || existing?.courtBiayaId || null;
    const profitLoss = totalIncome - cockCost - courtCost;

    const data = {
      scheduleId,
      pbId,
      totalIncome,
      cockCost,
      courtCost,
      cockBiayaId,
      courtBiayaId,
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
