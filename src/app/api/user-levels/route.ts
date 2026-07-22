import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const levels = await prisma.userLevel.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(levels);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, description, color } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Nama dan slug harus diisi" }, { status: 400 });
    }

    const dup = await prisma.userLevel.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (dup) {
      return NextResponse.json({ error: "Nama atau slug sudah digunakan" }, { status: 409 });
    }

    const level = await prisma.userLevel.create({
      data: { name, slug, description: description || null, color: color || "#0d9488" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(level, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
