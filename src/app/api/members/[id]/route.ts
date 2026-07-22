import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const member = await prisma.member.update({ where: { id }, data: body });
  return NextResponse.json(member);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.member.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
