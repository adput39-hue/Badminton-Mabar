import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryPbId = url.searchParams.get("pbId");
    const headerPbId = request.headers.get("x-pb-id");
    const pbId = queryPbId || headerPbId;
    const where = pbId ? { pbId } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { level: true },
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, password, role, levelId, avatarUrl } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json({ error: "Nama, email, dan password harus diisi" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });
    }

    const pbId = body.pbId || request.headers.get("x-pb-id") || "default";
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        password: hashed,
        role: role || "admin_pb",
        levelId: levelId || null,
        avatarUrl: avatarUrl || null,
        pbId,
      },
      include: { level: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
