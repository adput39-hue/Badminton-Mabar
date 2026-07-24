import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const items = await prisma.kasMutasi.findMany({ where, orderBy: { tanggal: "desc" } });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const item = await prisma.kasMutasi.create({
      data: {
        pbId,
        type: body.type,
        biayaId: body.biayaId || null,
        description: body.description,
        amount: parseInt(body.amount),
        tanggal: body.tanggal ? new Date(body.tanggal) : new Date(),
        reference: body.reference || null,
        memberId: body.memberId || null,
        createdBy: body.createdBy || null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/kas-mutasi error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}