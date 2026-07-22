import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const pbs = await prisma.pb.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, members: true, schedules: true } },
      },
    });
    return NextResponse.json(pbs);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, address, phone, adminEmail, adminFullName, adminPassword } = body;

    if (!name || !slug || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: "Nama, slug, email admin, dan password admin harus diisi" }, { status: 400 });
    }

    const existing = await prisma.pb.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
    }

    const emailExists = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (emailExists) {
      return NextResponse.json({ error: "Email admin sudah digunakan" }, { status: 409 });
    }

    const pb = await prisma.pb.create({
      data: {
        name,
        slug,
        address: address || null,
        phone: phone || null,
        users: {
          create: {
            email: adminEmail,
            fullName: adminFullName || "Admin " + name,
            password: await bcrypt.hash(adminPassword, 10),
            role: "admin_pb",
          },
        },
      },
      include: { _count: { select: { users: true, members: true, schedules: true } } },
    });

    return NextResponse.json(pb, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
