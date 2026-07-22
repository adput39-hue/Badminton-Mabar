import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const attendance = await prisma.attendance.update({ where: { id }, data: body });
  return NextResponse.json(attendance);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.attendance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
