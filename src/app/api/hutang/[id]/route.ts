import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const pbId = request.headers.get("x-pb-id");
  if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

  if (body.saldoAwalHutang !== undefined) {
    const member = await prisma.member.findFirst({ where: { id, pbId } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const updated = await prisma.member.update({
      where: { id },
      data: { saldoAwalHutang: parseInt(body.saldoAwalHutang) || 0 },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No valid field to update" }, { status: 400 });
}