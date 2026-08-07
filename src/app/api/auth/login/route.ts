import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password harus diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        level: { select: { id: true, name: true, slug: true, menus: true } },
        pb: { select: { id: true, name: true, logoUrl: true, primaryColor: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Email tidak ditemukan" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        pbId: user.pbId,
        levelId: user.levelId,
        level: user.level,
        pb: user.pb,
        primaryColor: user.pb?.primaryColor || null,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
