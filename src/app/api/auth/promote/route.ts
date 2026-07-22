import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!firstUser) {
      return NextResponse.json({ error: "Tidak ada user ditemukan. Jalankan setup dulu." }, { status: 400 });
    }
    if (firstUser.role === "superadmin") {
      return NextResponse.json({ message: "User sudah menjadi Super Admin" });
    }
    const user = await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: "superadmin" },
    });
    return NextResponse.json({
      message: "User berhasil dipromosikan menjadi Super Admin",
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
