import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { fullName, email, phone, password, role, levelId, avatarUrl } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (email && email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup) return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone || null;
    if (role !== undefined) data.role = role;
    if (levelId !== undefined) data.levelId = levelId || null;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { level: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
