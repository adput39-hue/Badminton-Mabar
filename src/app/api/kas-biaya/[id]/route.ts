import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = { ...body };
  if (body.amount !== undefined) data.amount = body.amount ? parseInt(body.amount) : null;
  const item = await prisma.kasBiaya.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.kasBiaya.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}