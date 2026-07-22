import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const existing = await prisma.user.findFirst();
    if (existing) {
      return NextResponse.json({ message: "Sudah ada user. Setup tidak perlu diulang." });
    }

    const pb = await prisma.pb.create({
      data: { id: "default", name: "PB Badminton Saya", slug: "pb-default" },
    });

    const hashed = await bcrypt.hash("admin123", 10);

    await prisma.user.create({
      data: {
        email: "admin@badminton.com",
        fullName: "Super Admin",
        password: hashed,
        role: "superadmin",
        pbId: pb.id,
      },
    });

    return NextResponse.json({
      message: "Setup berhasil!",
      login: { email: "admin@badminton.com", password: "admin123", role: "superadmin" },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
