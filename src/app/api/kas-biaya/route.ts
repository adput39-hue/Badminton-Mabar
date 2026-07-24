import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const items = await prisma.kasBiaya.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const item = await prisma.kasBiaya.create({
      data: {
        pbId,
        name: body.name,
        type: body.type,
        amount: body.amount ? parseInt(body.amount) : null,
        description: body.description || null,
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/kas-biaya error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}