import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const config = await prisma.appConfig.findUnique({ where: { id: "default" } });
  return NextResponse.json(config || { id: "default", favicon: null });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const config = await prisma.appConfig.upsert({
      where: { id: "default" },
      create: { id: "default", favicon: body.favicon || null },
      update: { favicon: body.favicon || null },
    });
    return NextResponse.json(config);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
