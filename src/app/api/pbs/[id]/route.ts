import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, address, phone } = body;

    const existing = await prisma.pb.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "PB tidak ditemukan" }, { status: 404 });
    }

    if (slug && slug !== existing.slug) {
      const dup = await prisma.pb.findUnique({ where: { slug } });
      if (dup) return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (address !== undefined) data.address = address || null;
    if (phone !== undefined) data.phone = phone || null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;

    const pb = await prisma.pb.update({
      where: { id },
      data,
      include: { _count: { select: { users: true, members: true, schedules: true } } },
    });
    return NextResponse.json(pb);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pb = await prisma.pb.findUnique({ where: { id } });
    if (!pb) {
      return NextResponse.json({ error: "PB tidak ditemukan" }, { status: 404 });
    }
    await prisma.pb.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
