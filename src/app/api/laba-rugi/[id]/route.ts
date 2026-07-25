import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.labaRugi.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.cockCost !== undefined) data.cockCost = body.cockCost;
    if (body.courtCost !== undefined) data.courtCost = body.courtCost;
    if (body.cockBiayaId !== undefined) data.cockBiayaId = body.cockBiayaId || null;
    if (body.courtBiayaId !== undefined) data.courtBiayaId = body.courtBiayaId || null;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.totalIncome !== undefined) data.totalIncome = body.totalIncome;
    if (body.profitLoss !== undefined) data.profitLoss = body.profitLoss;

    const item = await prisma.labaRugi.update({
      where: { id },
      data,
      include: { schedule: true, cockBiaya: true, courtBiaya: true },
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
