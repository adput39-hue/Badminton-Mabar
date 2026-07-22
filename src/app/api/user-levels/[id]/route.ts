import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, color } = body;

    const existing = await prisma.userLevel.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Level tidak ditemukan" }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const dup = await prisma.userLevel.findUnique({ where: { name } });
      if (dup) return NextResponse.json({ error: "Nama sudah digunakan" }, { status: 409 });
    }
    if (slug && slug !== existing.slug) {
      const dup = await prisma.userLevel.findUnique({ where: { slug } });
      if (dup) return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (description !== undefined) data.description = description || null;
    if (color !== undefined) data.color = color || "#0d9488";

    const level = await prisma.userLevel.update({
      where: { id },
      data,
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(level);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const count = await prisma.user.count({ where: { levelId: id } });
    if (count > 0) {
      return NextResponse.json({ error: "Level masih digunakan oleh " + count + " user. Hapus atau pindahkan user terlebih dahulu." }, { status: 400 });
    }
    await prisma.userLevel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
